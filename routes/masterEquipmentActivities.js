const express = require('express');
const router = express.Router();
const MasterEquipmentActivities = require('../models/masterEquipmentActivitiesModel');
const { User } = require('../models/userModel');
const { protectRoute } = require('./authentication');
const multer = require('multer');
const path = require('path');
const pdfController = require('./masterEquipmentActivitiesPdfController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/equipment-activities'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// --- FIXED GET ROUTE: Shows EVERYTHING from 'masterEquipmentActivities' ---
router.get('/', protectRoute, async (req, res) => {
  try {
    const user = req.user;
    console.log(`User ${user.full_name} fetching Master Equipment Activities...`);

    let query = {};

    // If you are Admin, see EVERYTHING.
    // If you are regular user, see Approved + Created by Me + Assigned to Me
    if (user.role !== 'Admin' && user.role !== 'Supervisor') {
        const userIdString = user._id.toString();
        query = {
            $or: [
                { status: 'Approved' },
                { 'reviewers.user_id': userIdString },
                { 'approvers.user_id': userIdString },
                { created_by: userIdString } 
            ]
        };
    }

    const activities = await MasterEquipmentActivities.find(query).sort({ createdAt: -1 });
    console.log(`Found ${activities.length} master activities.`);
    res.json(activities);

  } catch (err) {
    console.error('Error fetching master activities:', err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Other routes remain standard
router.get('/users', protectRoute, async (req, res) => {
  try {
    const allUsers = await User.find().select('full_name _id role');
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get approved activities only (for eLog order creation)
router.get('/approved-activities', protectRoute, async (req, res) => {
  try {
    const approvedActivities = await MasterEquipmentActivities.find({
      status: 'Approved'
    }).select('product_name activity_name _id');
    res.json(approvedActivities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch approved activities' });
  }
});

// Get a single master equipment activity by ID
router.get('/:id', protectRoute, async (req, res) => {
  try {
    const activity = await MasterEquipmentActivities.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ error: 'Master equipment activity not found' });
    }
    res.json(activity);
  } catch (err) {
    console.error('Error fetching master equipment activity:', err);
    res.status(500).json({ error: 'Failed to fetch master equipment activity' });
  }
});

router.post('/', protectRoute, upload.single('original_doc'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.jsonData);
    delete data._id; // Ensure new ID is generated
    
    const newActivity = new MasterEquipmentActivities({
      ...data,
      status: 'Created',
      created_by: req.user._id.toString(),
      reviewers: [],
      approvers: [],
      original_doc_path: req.file ? req.file.path : null,
      rejection_info: null
    });
    
    await newActivity.save();
    res.status(201).json(newActivity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

router.patch('/:id/assign-workflow', protectRoute, async (req, res) => {
  try {
    const { reviewers, approvers } = req.body;
    const activity = await MasterEquipmentActivities.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          reviewers: reviewers.map(r => ({ ...r, has_reviewed: false })),
          approvers: approvers.map(a => ({ ...a, has_approved: false })),
          status: 'Under Review',
          rejection_info: null
        }
      },
      { new: true }
    );
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign workflow' });
  }
});

router.patch('/:id/submit-review', protectRoute, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const activity = await MasterEquipmentActivities.findById(req.params.id);
    const reviewer = activity.reviewers.find(r => r.user_id === userId);
    if (!reviewer) return res.status(403).json({ error: 'Not a reviewer' });

    reviewer.has_reviewed = true;
    if (activity.reviewers.every(r => r.has_reviewed)) activity.status = 'Pending for approval';
    
    await activity.save();
    res.json(activity);
  } catch (err) { res.status(500).json({ error: 'Review failed' }); }
});

router.patch('/:id/approve', protectRoute, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const activity = await MasterEquipmentActivities.findById(req.params.id);
    
    if (req.user.role === 'Admin') {
        activity.status = 'Approved';
        await activity.save();
        return res.json(activity);
    }

    const approver = activity.approvers.find(a => a.user_id === userId);
    if (!approver) return res.status(403).json({ error: 'Not an approver' });

    approver.has_approved = true;
    if (activity.approvers.every(a => a.has_approved)) activity.status = 'Approved';
    
    await activity.save();
    res.json(activity);
  } catch (err) { res.status(500).json({ error: 'Approval failed' }); }
});

router.get('/:id/download-approval-pdf', protectRoute, pdfController.downloadApprovalPdf);

// Add other standard routes (delete, update) as needed...
module.exports = router;