const express = require("express");
const router = express.Router();
const MasterInstruction = require("../models/masterInstructionModel");
const { User } = require("../models/userModel");
const { protectRoute } = require("./authentication");
const multer = require("multer");
const path = require("path");

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

router.patch("/:id/assign-workflow", protectRoute, async (req, res) => {
  try {
    const { reviewers, approvers } = req.body;
    if (!reviewers || reviewers.length === 0) return res.status(400).json({ error: "At least one reviewer is required." });
    if (!approvers || approvers.length === 0) return res.status(400).json({ error: "At least one approver is required." });
    
    const instruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          reviewers: reviewers,  
          approvers: approvers,  
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

router.patch("/:id/submit-review", protectRoute, async (req, res) => {
  try {
    const instruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'Pending for approval' } },
      { new: true }
    );
    res.json(instruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit review" });
  }
});

router.patch("/:id/approve", protectRoute, async (req, res) => {
  try {
    const updatedInstruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "Approved", reviewers: [] } },
      { new: true }
    );
    res.json(updatedInstruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to approve instruction" });
  }
});

// --- UPDATED REJECT ROUTE ---
router.patch("/:id/reject", protectRoute, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "A rejection reason is required." });

    const instruction = await MasterInstruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ error: "Instruction not found." });

    const userRole = req.user.role;
    const userId = req.user._id.toString();
    
    const isReviewer = instruction.reviewers.some(r => r.user_id === userId); 
    const isApprover = instruction.approvers.some(a => a.user_id === userId);

    if (userRole !== 'Admin' && !isReviewer && !isApprover) {
      return res.status(403).json({ error: "You do not have permission to reject this." });
    }

    const updatedInstruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          status: "Created",         
          rejection_info: {
            reason: reason,
            rejected_by: req.user.full_name, // Save user's name
            rejected_at: new Date()          // Save current time
          },
          reviewers: [], 
          approvers: []              
        } 
      },
      { new: true }
    );
    res.json(updatedInstruction);
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

router.get("/:id", protectRoute, async (req, res) => {
  try {
    const masterInstruction = await MasterInstruction.findById(req.params.id);
    if (!masterInstruction) return res.status(404).json({ error: "Master instruction not found" });
    res.json(masterInstruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch master instruction" });
  }
});

module.exports = router;