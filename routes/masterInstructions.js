const express = require("express");
const router = express.Router();
const MasterInstruction = require("../models/masterInstructionModel");
const { User } = require("../models/userModel");
const { protectRoute } = require("./authentication");
const multer = require("multer");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/documents'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.get("/users", protectRoute, async (req, res) => {
  try {
    const allUsers = await User.find().select("full_name _id role");
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/approved-products", protectRoute, async (req, res) => {
  try {
    const approvedProducts = await MasterInstruction.find({
      status: 'Approved' 
    }).select("product_name _id");
    res.json(approvedProducts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch approved products" });
  }
});

router.get("/", protectRoute, async (req, res) => {
  try {
    const user = req.user;
    let query = {};
    if (user.role === "Admin" || user.role === "Supervisor") {
      query = {}; 
    } else {
      query = {
        $or: [
          { status: "Approved" },
          { "reviewers.user_id": user._id.toString() }, 
          { "approvers.user_id": user._id.toString() },
        ],
      };
    }
    const masterInstructions = await MasterInstruction.find(query);
    res.json(masterInstructions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch instructions" });
  }
});

router.post("/", protectRoute, upload.single('original_doc'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.jsonData);
    if (!req.file) {
      return res.status(400).json({ error: "No document file was uploaded." });
    }
    const newInstruction = new MasterInstruction({
      ...data,
      status: "Created",
      reviewers: [],
      approvers: [],
      original_doc_path: req.file.path,
      rejection_info: null,
      review_note: ''
    });
    await newInstruction.save();
    res.status(201).json(newInstruction);
  } catch (err) {
    console.error("Error saving master instruction:", err);
    res.status(500).json({ error: "Failed to save master instruction" });
  }
});

router.patch("/:id/assign-workflow", protectRoute, async (req, res) => {
  try {
    const { reviewers, approvers } = req.body;
    
    // Reset flags when assigning
    const reviewersWithFlags = reviewers.map(r => ({ ...r, has_reviewed: false }));
    const approversWithFlags = approvers.map(a => ({ ...a, has_approved: false }));

    if (reviewers.length === 0) return res.status(400).json({ error: "At least one reviewer is required." });
    if (approvers.length === 0) return res.status(400).json({ error: "At least one approver is required." });
    
    const instruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          reviewers: reviewersWithFlags,  
          approvers: approversWithFlags,  
          status: 'Under Review',
          rejection_info: null,
          review_note: ''
        } 
      },
      { new: true }
    );
    res.json(instruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to assign workflow" });
  }
});

// --- UPDATED: ALL Reviewers must finish ---
router.patch("/:id/submit-review", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const instruction = await MasterInstruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ error: "Not found" });

    const reviewer = instruction.reviewers.find(r => r.user_id === userId);
    if (!reviewer) return res.status(403).json({ error: "You are not a reviewer." });

    // 1. Mark this user as done
    reviewer.has_reviewed = true;

    // 2. CHECK: Are ALL reviewers done?
    const allDone = instruction.reviewers.every(r => r.has_reviewed === true);
    
    if (allDone) {
      instruction.status = 'Pending for approval'; // Move to next stage
    }
    // If not all done, status stays "Under Review"

    await instruction.save();
    res.json(instruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit review" });
  }
});


// REPLACE your existing approve route with this:
router.patch("/:id/approve", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const instruction = await MasterInstruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ error: "Not found" });

    // --- FIX: Use full_name (with username as backup) ---
    const currentUserName = req.user.full_name || req.user.username || "Authorized User";

    console.log(`[DEBUG] User '${currentUserName}' (ID: ${userId}) is clicking Approve.`);

    // --- HELPER: Stamp the document ---
    const performStamping = (namesToPrint) => {
      try {
        const approvedDate = new Date().toLocaleDateString();
        const filePath = path.join(__dirname, '..', instruction.original_doc_path);
        
        console.log(`[DEBUG] Stamping File at: ${filePath}`);
        console.log(`[DEBUG] Printing Names: "${namesToPrint}"`);

        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "binary");
          const zip = new PizZip(content);
          const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

          // Renders data into the Word file
          // Ensure your Word doc has {name} inside it
          doc.render({
            name: namesToPrint, 
            date: approvedDate
          });

          const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
          fs.writeFileSync(filePath, buf);
          console.log(`[DEBUG] SUCCESS! File saved.`);
        } else {
          console.error(`[DEBUG] ERROR: File NOT found at ${filePath}`);
        }
      } catch (error) {
        console.error("[DEBUG] CRITICAL STAMPING ERROR:", error);
      }
    };
    // --------------------------------

    const approver = instruction.approvers.find(a => a.user_id === userId);

    // SCENARIO 1: ADMIN FORCE-APPROVE
    if (req.user.role === 'Admin' && !approver) {
         console.log("[DEBUG] Admin Force-Approve triggered.");
         instruction.status = 'Approved';
         instruction.reviewers = []; 
         
         // Use the Admin's full_name
         performStamping(currentUserName); 

         await instruction.save();
         return res.json(instruction);
    }

    // SCENARIO 2: REGULAR APPROVER
    if (!approver) return res.status(403).json({ error: "You are not an approver." });

    approver.has_approved = true;

    // Check if everyone has approved
    const allDone = instruction.approvers.every(a => a.has_approved === true);

    if (allDone) {
      console.log("[DEBUG] All approved. Collecting names...");
      instruction.status = 'Approved'; 
      instruction.reviewers = []; 

      // --- FIX: Map over the list to get full_name for everyone ---
      // We check a.full_name first, then a.username, then a.name
      const allApproverNames = instruction.approvers
          .map(a => a.full_name || a.username || a.name || "Unknown")
          .join(", ");
      
      performStamping(allApproverNames);

    } else {
        console.log("[DEBUG] Waiting for other approvers.");
    }

    await instruction.save();
    res.json(instruction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve instruction" });
  }
});
router.patch("/:id/reject", protectRoute, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "Reason required." });

    const instruction = await MasterInstruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ error: "Not found" });

    const userId = req.user._id.toString();
    const isReviewer = instruction.reviewers.some(r => r.user_id === userId); 
    const isApprover = instruction.approvers.some(a => a.user_id === userId);

    if (req.user.role !== 'Admin' && !isReviewer && !isApprover) {
      return res.status(403).json({ error: "Permission denied." });
    }

    
    instruction.status = "Created";
    instruction.rejection_info = {
        reason: reason,
        rejected_by: req.user.full_name,
        rejected_at: new Date()
    };
   
    instruction.reviewers = [];
    instruction.approvers = [];
    
    await instruction.save();
    res.json(instruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to reject instruction" });
  }
});

router.patch("/:id/save-note", protectRoute, async (req, res) => {
  try {
    const { note } = req.body;
    const instruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { $set: { review_note: note } },
      { new: true }
    );
    res.json(instruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to save note" });
  }
});

router.post("/:id/comment", protectRoute, async (req, res) => {
  try {
    const { pageIndex, comment } = req.body;
    if (pageIndex === undefined || !comment) {
      return res.status(400).json({ error: "Page index and comment are required." });
    }

    const instruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { 
        $push: { 
          comments: {
            pageIndex: pageIndex,
            comment: comment,
            user: req.user.full_name,
            date: new Date()
          } 
        } 
      },
      { new: true }
    );
    res.json(instruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to add comment" });
  }
});

router.get("/:id", protectRoute, async (req, res) => {
  try {
    const masterInstruction = await MasterInstruction.findById(req.params.id);
    if (!masterInstruction) return res.status(404).json({ error: "Not found" });
    res.json(masterInstruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch" });
  }
});

router.post("/:id/upload-revision", protectRoute, upload.single('original_doc'), async (req, res) => {
  try {
    const instruction = await MasterInstruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ error: "Instruction not found" });

    // 1. Archive the CURRENT version (including COMMENTS) into history
    if (instruction.original_doc_path) {
      instruction.history.push({
        version: instruction.version || 1,
        doc_path: instruction.original_doc_path,
        rejection_info: instruction.rejection_info ? instruction.rejection_info : null,
        comments: instruction.comments || [], // <--- ARCHIVE COMMENTS HERE
        archived_at: new Date()
      });
    }

    // 2. Update with NEW data
    const data = JSON.parse(req.body.jsonData);
    
    instruction.product_name = data.product_name;
    instruction.instructions = data.instructions;
    
    if (req.file) {
        instruction.original_doc_path = req.file.path;
    }
    
    instruction.version = (instruction.version || 1) + 1; 
    
    // 3. Reset Status and CLEAR comments for the new version
    instruction.status = "Created";
    instruction.rejection_info = null; 
    instruction.review_note = "";
    instruction.comments = []; // <--- CLEAR COMMENTS for fresh start
    instruction.reviewers = []; 
    instruction.approvers = [];

    await instruction.save();
    res.json(instruction);

  } catch (err) {
    console.error("Error uploading revision:", err);
    res.status(500).json({ error: "Failed to upload revision" });
  }
});

module.exports = router;