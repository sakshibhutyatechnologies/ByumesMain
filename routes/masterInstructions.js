const express = require("express");
const router = express.Router();
const MasterInstruction = require("../models/masterInstructionModel");
const { User } = require("../models/userModel");
const { protectRoute } = require("./authentication");
const multer = require("multer");
const path = require("path");

// --- MULTER CONFIG ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/documents'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// GET ALL USERS
router.get("/users", protectRoute, async (req, res) => {
  try {
    const allUsers = await User.find().select("full_name _id role");
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET APPROVED PRODUCTS
router.get("/approved-products", protectRoute, async (req, res) => {
  try {
    const approvedProducts = await MasterInstruction.find({ status: 'Approved' }).select("product_name _id");
    res.json(approvedProducts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch approved products" });
  }
});

// GET ALL INSTRUCTIONS
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

// CREATE NEW
router.post("/", protectRoute, upload.single('original_doc'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.jsonData);
    if (!req.file) return res.status(400).json({ error: "No document file was uploaded." });

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

// ASSIGN WORKFLOW
router.patch("/:id/assign-workflow", protectRoute, async (req, res) => {
  try {
    const { reviewers, approvers } = req.body;
    // Reset flags to false when assigning
    const reviewersWithFlags = reviewers.map(r => ({ ...r, has_reviewed: false }));
    const approversWithFlags = approvers.map(a => ({ ...a, has_approved: false }));

    if (reviewers.length === 0) return res.status(400).json({ error: "Reviewer required." });
    if (approvers.length === 0) return res.status(400).json({ error: "Approver required." });
    
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

// --- UPDATED: SUBMIT REVIEW (Wait for everyone) ---
router.patch("/:id/submit-review", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const instruction = await MasterInstruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ error: "Instruction not found" });

    // Find the reviewer in the list
    const reviewer = instruction.reviewers.find(r => r.user_id === userId);
    if (!reviewer) return res.status(403).json({ error: "You are not a reviewer." });

    // Mark THIS user as done
    reviewer.has_reviewed = true;

    // Check if ALL reviewers are done
    const allDone = instruction.reviewers.every(r => r.has_reviewed === true);
    
    if (allDone) {
      instruction.status = 'Pending for approval'; // Move to next stage
    }

    await instruction.save();
    res.json(instruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// --- UPDATED: APPROVE (Wait for everyone) ---
router.patch("/:id/approve", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const instruction = await MasterInstruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ error: "Instruction not found" });

    // Admin Bypass: Admins can force approval instantly
    if (req.user.role === 'Admin') {
         instruction.status = 'Approved';
         instruction.reviewers = []; // Clear lists
         await instruction.save();
         return res.json(instruction);
    }

    // Find the approver
    const approver = instruction.approvers.find(a => a.user_id === userId);
    if (!approver) return res.status(403).json({ error: "You are not an approver." });

    // Mark THIS user as done
    approver.has_approved = true;

    // Check if ALL approvers are done
    const allDone = instruction.approvers.every(a => a.has_approved === true);

    if (allDone) {
      instruction.status = 'Approved'; // Final stage
      instruction.reviewers = []; // Cleanup
    }

    await instruction.save();
    res.json(instruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to approve instruction" });
  }
});

// REJECT (Any rejection resets everything)
router.patch("/:id/reject", protectRoute, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "Reason required." });

    const instruction = await MasterInstruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ error: "Not found." });

    const userId = req.user._id.toString();
    const isReviewer = instruction.reviewers.some(r => r.user_id === userId); 
    const isApprover = instruction.approvers.some(a => a.user_id === userId);

    if (req.user.role !== 'Admin' && !isReviewer && !isApprover) {
      return res.status(403).json({ error: "Permission denied." });
    }

    // Reset to Created and clear all progress
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
    res.status(500).json({ error: "Failed to reject" });
  }
});

// SAVE NOTE
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

// GET SINGLE
router.get("/:id", protectRoute, async (req, res) => {
  try {
    const masterInstruction = await MasterInstruction.findById(req.params.id);
    if (!masterInstruction) return res.status(404).json({ error: "Not found" });
    res.json(masterInstruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch" });
  }
});


// ... (keep existing routes) ...

// UPLOAD A NEW VERSION (Revision)
router.post("/:id/upload-revision", protectRoute, upload.single('original_doc'), async (req, res) => {
  try {
    const instruction = await MasterInstruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ error: "Instruction not found" });

    // 1. Archive the CURRENT version into history
    if (instruction.original_doc_path) {
      instruction.history.push({
        version: instruction.version,
        doc_path: instruction.original_doc_path,
        rejection_reason: instruction.rejection_info ? instruction.rejection_info.reason : null,
        rejected_by: instruction.rejection_info ? instruction.rejection_info.rejected_by : null,
        rejected_at: instruction.rejection_info ? instruction.rejection_info.rejected_at : null,
      });
    }

    // 2. Update with NEW data
    const data = JSON.parse(req.body.jsonData);
    
    instruction.product_name = data.product_name;
    instruction.instructions = data.instructions;
    instruction.original_doc_path = req.file.path; // New file path
    instruction.version = instruction.version + 1; // Increment version
    
    // 3. Reset Status to Created (so Admin can assign workflow again)
    instruction.status = "Created";
    instruction.rejection_info = null; // Clear rejection so it looks clean
    instruction.review_note = "";

    await instruction.save();
    res.json(instruction);

  } catch (err) {
    console.error("Error uploading revision:", err);
    res.status(500).json({ error: "Failed to upload revision" });
  }
});

module.exports = router;
