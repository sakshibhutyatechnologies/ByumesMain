const express = require("express");
const router = express.Router();
const MasterInstruction = require("../models/masterInstructionModel");
const { User } = require("../models/userModel");
const { protectRoute } = require("./authentication");
const multer = require("multer");
const path = require("path");

// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/documents'); // Make sure you create an 'uploads/documents' folder
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });
// --- END OF MULTER CONFIG ---

// GET ALL USERS (for Reviewer and Approver dropdowns)
router.get("/users", protectRoute, async (req, res) => {
  try {
    const allUsers = await User.find().select("full_name _id role");
    res.json(allUsers);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET ONLY APPROVED PRODUCTS (For 'Create New Order' modal)
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

// GET ALL INSTRUCTIONS (Filtered by Role for the main Products page)
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
          { "reviewer.user_id": user._id.toString() },
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

// CREATE A NEW INSTRUCTION (Status: Created)
router.post(
  "/", 
  protectRoute, 
  upload.single('original_doc'), 
  async (req, res) => {
    try {
      const data = JSON.parse(req.body.jsonData);

      if (!req.file) {
        return res.status(400).json({ error: "No document file was uploaded." });
      }

      const newInstruction = new MasterInstruction({
        ...data,
        status: "Created",
        reviewer: null,
        approvers: [],
        original_doc_path: req.file.path,
        rejection_reason: null 
      });
      
      await newInstruction.save();
      res.status(201).json(newInstruction);
    } catch (err) {
      console.error("Error saving master instruction:", err);
      res.status(500).json({ error: "Failed to save master instruction" });
    }
  }
);

// ASSIGN A REVIEWER (Status: Created -> Under Review)
router.patch("/:id/assign-reviewer", protectRoute, async (req, res) => {
  try {
    const { userId, username } = req.body;
    if (!userId || !username) {
      return res.status(400).json({ error: "Reviewer user ID and username are required." });
    }
    
    const instruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          reviewer: { user_id: userId, username: username },
          status: 'Under Review',
          rejection_reason: null // Clear old rejection reason
        } 
      },
      { new: true }
    );
    res.json(instruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to assign reviewer" });
  }
});

// SUBMIT A REVIEW (Status: Under Review -> Pending for approval)
router.patch("/:id/submit-review", protectRoute, async (req, res) => {
  try {
    const instruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          status: 'Pending for approval' 
        } 
      },
      { new: true }
    );
    res.json(instruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// ASSIGN APPROVER(S) (Status: Stays Pending for approval)
router.patch("/:id/assign-approver", protectRoute, async (req, res) => {
  try {
    const { approvers } = req.body; 
    if (!approvers || approvers.length === 0) {
        return res.status(400).json({ error: "At least one approver is required." });
    }
    
    const instruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          approvers: approvers 
        } 
      },
      { new: true }
    );
    res.json(instruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to assign approvers" });
  }
});

// APPROVE THE INSTRUCTION (Status: Pending for approval -> Approved)
router.patch("/:id/approve", protectRoute, async (req, res) => {
  try {
    const updatedInstruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          status: "Approved", 
          reviewer: null 
        } 
      },
      { new: true }
    );
    res.json(updatedInstruction);
  } catch (err) {
    console.error("Error approving instruction:", err);
    res.status(500).json({ error: "Failed to approve instruction" });
  }
});

// REJECT A DOCUMENT (Works for Reviewer or Approver)
router.patch("/:id/reject", protectRoute, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: "A rejection reason is required." });
    }

    const instruction = await MasterInstruction.findById(req.params.id);
    if (!instruction) {
      return res.status(404).json({ error: "Instruction not found." });
    }

    const userRole = req.user.role;
    const userId = req.user._id.toString();
    
    const isReviewer = instruction.reviewer && instruction.reviewer.user_id === userId;
    const isApprover = instruction.approvers.some(a => a.user_id === userId);

    if (userRole !== 'Admin' && !isReviewer && !isApprover) {
      return res.status(403).json({ error: "You do not have permission to reject this." });
    }

    const updatedInstruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          status: "Created",         
          rejection_reason: reason,  
          reviewer: null,            
          approvers: []              
        } 
      },
      { new: true }
    );
    res.json(updatedInstruction);
  } catch (err) {
    console.error("Error rejecting instruction:", err);
    res.status(500).json({ error: "Failed to reject instruction" });
  }
});

// GET A SINGLE INSTRUCTION BY ID
router.get("/:id", protectRoute, async (req, res) => {
  try {
    const masterInstruction = await MasterInstruction.findById(req.params.id);
    if (!masterInstruction) {
      return res.status(404).json({ error: "Master instruction not found" });
    }
    res.json(masterInstruction);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch master instruction" });
  }
});

module.exports = router;