const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const express = require("express");
const router = express.Router();
const MasterInstruction = require("../models/masterInstructionModel");
const { User } = require("../models/userModel");
const { protectRoute } = require("./authentication");
const multer = require("multer");
const path = require("path");
const pdfController = require('./masterInstructionPdfController');
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
            created_by: req.user._id.toString(),
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
        reviewer.reviewed_at = new Date();

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

// --- UPDATED: ONE Approver is enough ---
router.patch("/:id/approve", protectRoute, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const instruction = await MasterInstruction.findById(req.params.id);
        if (!instruction) return res.status(404).json({ error: "Not found" });

        // Admin bypass: Admins can force instant approval if they want
        if (req.user.role === 'Admin') {
            instruction.status = 'Approved';
            instruction.reviewers = [];
            await instruction.save();
            return res.json(instruction);
        }

        const approver = instruction.approvers.find(a => a.user_id === userId);
        if (!approver) return res.status(403).json({ error: "You are not an approver." });

        // 1. Mark this user as done
        approver.has_approved = true;
        approver.approved_at = new Date();

        // 2. CHECK: Are ALL approvers done?
        const allDone = instruction.approvers.every(a => a.has_approved === true);

        if (allDone) {
            instruction.status = 'Approved'; // Move to final stage

        }
        // If not all done, status stays "Pending for approval"

        await instruction.save();
        res.json(instruction);
    } catch (err) {
        res.status(500).json({ error: "Failed to approve instruction" });
    }
});

router.patch("/:id/reject", protectRoute, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: "Reason required." });

        const instruction = await MasterInstruction.findById(req.params.id);
        if (!instruction) return res.status(404).json({ error: "Not found" });

        // Prevent rejection of approved documents
        if (instruction.status === 'Approved') {
            return res.status(403).json({ error: "Cannot reject an approved document. Only admins can initiate change workflows for approved documents." });
        }

        const userId = req.user._id.toString();
        const isReviewer = instruction.reviewers.some(r => r.user_id === userId);
        const isApprover = instruction.approvers.some(a => a.user_id === userId);

        if (req.user.role !== 'Admin' && !isReviewer && !isApprover) {
            return res.status(403).json({ error: "Permission denied." });
        }

        // Reset everything on reject
        instruction.status = "Created";
        instruction.rejection_info = {
            reason: reason,
            rejected_by: req.user.full_name,
            rejected_at: new Date()
        };
        // Clear flags and lists so Admin must re-assign
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
router.get("/:id/download-approval-pdf", protectRoute, pdfController.downloadApprovalPdf);

router.get("/:id", protectRoute, async (req, res) => {
    try {
        const masterInstruction = await MasterInstruction.findById(req.params.id);
        if (!masterInstruction) return res.status(404).json({ error: "Not found" });
        res.json(masterInstruction);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch" });
    }
});

// --- NEW: ASSIGN CHANGE WORKFLOW (Admin Only) ---
router.post("/:id/assign-change-workflow", protectRoute, async (req, res) => {
    try {
        // 1. Admin-only check
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ error: "Only admins can initiate change workflows." });
        }

        // 2. Find the approved document
        const approvedDoc = await MasterInstruction.findById(req.params.id);
        if (!approvedDoc) {
            return res.status(404).json({ error: "Document not found" });
        }

        // 3. Verify it's approved
        if (approvedDoc.status !== 'Approved') {
            return res.status(400).json({ error: "Only approved documents can have change workflows initiated." });
        }

        // 4. Archive the current approved version in history
        if (approvedDoc.original_doc_path) {
            approvedDoc.history.push({
                version: approvedDoc.version || 1,
                doc_path: approvedDoc.original_doc_path,
                rejection_info: null,
                comments: approvedDoc.comments || [],
                archived_at: new Date()
            });
        }

        // 5. Increment version and reset for new workflow
        approvedDoc.version = (approvedDoc.version || 1) + 1;
        approvedDoc.status = "Created";
        approvedDoc.reviewers = [];
        approvedDoc.approvers = [];
        approvedDoc.rejection_info = null;
        approvedDoc.review_note = "";
        approvedDoc.comments = [];

        // 6. Save the updated document
        await approvedDoc.save();

        // 7. Return the new version
        res.json(approvedDoc);

    } catch (err) {
        console.error("Error initiating change workflow:", err);
        res.status(500).json({ error: "Failed to initiate change workflow" });
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