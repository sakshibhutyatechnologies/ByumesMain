const express = require('express');
const router = express.Router();
const EquipmentActivities = require('../models/equipmentActivitiesModel');
const { User } = require('../models/userModel');
const { protectRoute } = require('./authentication');
const multer = require('multer');
const path = require('path');
const pdfController = require('./equipmentActivitiesPdfController');

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/equipment-activities'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Get all users for assignment
router.get('/users', protectRoute, async (req, res) => {
  try {
    const allUsers = await User.find().select('full_name _id role');
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get approved activities only (for eLog order creation - eBR activities only)
router.get('/approved-activities', protectRoute, async (req, res) => {
  try {
    const approvedActivities = await EquipmentActivities.find({
      status: 'Approved',
      source: 'ebr' // Only eBR-converted activities
    }).select('product_name activity_name _id');
    res.json(approvedActivities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch approved activities' });
  }
});

// Get all activities with role-based filtering
router.get('/', protectRoute, async (req, res) => {
  try {
    const user = req.user;
    let query = { source: 'ebr' }; // Only show eBR activities, not eLog-created ones
    
    if (user.role === 'Admin' || user.role === 'Supervisor') {
      // Admin/Supervisor can see all eBR activities
      query = { source: 'ebr' };
    } else {
      const userIdString = user._id.toString();
      const userIdObj = user._id;
      
      query = {
        source: 'ebr', // Only eBR activities
        $or: [
          { status: 'Approved' },
          { 'reviewers.user_id': userIdString },
          { 'reviewers.user_id': userIdObj },
          { 'approvers.user_id': userIdString },
          { 'approvers.user_id': userIdObj },
        ],
      };
    }
    
    const activities = await EquipmentActivities.find(query);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Create new activity with file upload
router.post('/', protectRoute, upload.single('original_doc'), async (req, res) => {
  try {
    console.log('Received POST request to /equipmentActivities');
    
    let data;
    if (req.body.jsonData) {
      data = JSON.parse(req.body.jsonData);
    } else {
      data = req.body;
    }

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Missing activity data' });
    }
    console.log('Parsed data product_name:', data.product_name);
    
    const original_doc_path = req.file ? req.file.path : data.original_doc_path;
    
    delete data._id;
    
    const newActivity = new EquipmentActivities({
      ...data,
      status: 'Created',
      created_by: req.user._id.toString(),
      reviewers: [],
      approvers: [],
      original_doc_path: original_doc_path,
      rejection_info: null,
      review_note: ''
    });
    
    console.log('Attempting to save activity...');
    await newActivity.save();
    console.log('Activity saved successfully with ID:', newActivity._id);
    res.status(201).json(newActivity);
  } catch (err) {
    console.error('Error saving equipment activity:', err);
    res.status(500).json({ error: 'Failed to save equipment activity', details: err.message });
  }
});

// Assign workflow (reviewers and approvers)
router.patch('/:id/assign-workflow', protectRoute, async (req, res) => {
  try {
    const { reviewers, approvers } = req.body;
    
    const reviewersWithFlags = reviewers.map(r => ({ ...r, has_reviewed: false }));
    const approversWithFlags = approvers.map(a => ({ ...a, has_approved: false }));
    
    if (reviewers.length === 0) return res.status(400).json({ error: 'At least one reviewer is required.' });
    if (approvers.length === 0) return res.status(400).json({ error: 'At least one approver is required.' });
    
    const activity = await EquipmentActivities.findByIdAndUpdate(
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
    
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign workflow' });
  }
});

// Submit review
router.patch('/:id/submit-review', protectRoute, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Not found' });
    
    const reviewer = activity.reviewers.find(r => r.user_id === userId);
    if (!reviewer) return res.status(403).json({ error: 'You are not a reviewer.' });
    
    reviewer.has_reviewed = true;
    reviewer.reviewed_at = new Date();
    
    const allDone = activity.reviewers.every(r => r.has_reviewed === true);
    
    if (allDone) {
      activity.status = 'Pending for approval';
    }
    
    await activity.save();
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Approve
router.patch('/:id/approve', protectRoute, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Not found' });
    
    if (req.user.role === 'Admin') {
      activity.status = 'Approved';
      activity.reviewers = [];
      await activity.save();
      return res.json(activity);
    }
    
    const approver = activity.approvers.find(a => a.user_id === userId);
    if (!approver) return res.status(403).json({ error: 'You are not an approver.' });
    
    approver.has_approved = true;
    approver.approved_at = new Date();
    
    const allDone = activity.approvers.every(a => a.has_approved === true);
    
    if (allDone) {
      activity.status = 'Approved';
    }
    
    await activity.save();
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve activity' });
  }
});

// Reject
router.patch('/:id/reject', protectRoute, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason required.' });
    
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Not found' });
    
    // Prevent rejection of approved activities
    if (activity.status === 'Approved') {
      return res.status(403).json({ error: 'Cannot reject an approved activity. Only admins can initiate change workflows for approved activities.' });
    }
    
    const userId = req.user._id.toString();
    const isReviewer = activity.reviewers.some(r => r.user_id === userId);
    const isApprover = activity.approvers.some(a => a.user_id === userId);
    
    if (req.user.role !== 'Admin' && !isReviewer && !isApprover) {
      return res.status(403).json({ error: 'Permission denied.' });
    }
    
    activity.status = 'Created';
    activity.rejection_info = {
      reason: reason,
      rejected_by: req.user.full_name,
      rejected_at: new Date()
    };
    activity.reviewers = [];
    activity.approvers = [];
    
    await activity.save();
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject activity' });
  }
});

// Save note
router.patch('/:id/save-note', protectRoute, async (req, res) => {
  try {
    const { note } = req.body;
    const activity = await EquipmentActivities.findByIdAndUpdate(
      req.params.id,
      { $set: { review_note: note } },
      { new: true }
    );
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// Add workflow comment
router.post('/:id/workflow-comment', protectRoute, async (req, res) => {
  try {
    const { pageIndex, comment } = req.body;
    if (pageIndex === undefined || !comment) {
      return res.status(400).json({ error: 'Page index and comment are required.' });
    }
    
    const activity = await EquipmentActivities.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          workflow_comments: {
            pageIndex: pageIndex,
            comment: comment,
            user: req.user.full_name,
            date: new Date()
          }
        }
      },
      { new: true }
    );
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add workflow comment' });
  }
});

// Assign change workflow (Admin only)
router.post('/:id/assign-change-workflow', protectRoute, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can initiate change workflows.' });
    }
    
    const approvedDoc = await EquipmentActivities.findById(req.params.id);
    if (!approvedDoc) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    if (approvedDoc.status !== 'Approved') {
      return res.status(400).json({ error: 'Only approved activities can have change workflows initiated.' });
    }
    
    if (approvedDoc.original_doc_path) {
      approvedDoc.history.push({
        version: approvedDoc.version || 1,
        status: 'Approved',
        changed_at: new Date(),
        changed_by: req.user.full_name,
        change_reason: 'Initiated new revision'
      });
    }
    
    approvedDoc.version = (approvedDoc.version || 1) + 1;
    approvedDoc.status = 'Created';
    approvedDoc.reviewers = [];
    approvedDoc.approvers = [];
    approvedDoc.rejection_info = null;
    approvedDoc.review_note = '';
    approvedDoc.workflow_comments = [];
    
    await approvedDoc.save();
    res.json(approvedDoc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate change workflow' });
  }
});

// Upload revision
router.post('/:id/upload-revision', protectRoute, upload.single('original_doc'), async (req, res) => {
  try {
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    
    if (activity.original_doc_path) {
      activity.history.push({
        version: activity.version || 1,
        status: activity.status,
        changed_at: new Date(),
        changed_by: req.user.full_name,
        change_reason: 'Uploaded revision'
      });
    }
    
    const data = JSON.parse(req.body.jsonData);
    
    activity.product_name = data.product_name;
    activity.activity_name = data.activity_name;
    activity.activities = data.activities;
    
    if (req.file) {
      activity.original_doc_path = req.file.path;
    }
    
    activity.version = (activity.version || 1) + 1;
    activity.status = 'Created';
    activity.rejection_info = null;
    activity.review_note = '';
    activity.workflow_comments = [];
    activity.reviewers = [];
    activity.approvers = [];
    
    await activity.save();
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload revision' });
  }
});

// --- EXECUTION ROUTES ---

// Get a specific equipment activity by ID (simplified for compatibility)
router.get('/:id/details', async (req, res) => {
  try {
    const activity = await EquipmentActivities.findById(req.params.id).select('_id activity_name current_step current_qa_step');
    if (!activity) return res.status(404).json({ message: 'Not found' });
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id/current-step', async (req, res) => {
  try {
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) return res.status(404).json({ message: 'Not found' });
    res.status(200).json({ current_step: activity.current_step });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id/current-qa-step', async (req, res) => {
  try {
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) return res.status(404).json({ message: 'Not found' });
    res.status(200).json({ current_qa_step: activity.current_qa_step });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/current-step', async (req, res) => {
  try {
    const { current_step } = req.body;
    const activity = await EquipmentActivities.findByIdAndUpdate(req.params.id, { current_step }, { new: true });
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/current-qa-step', async (req, res) => {
  try {
    const { current_qa_step } = req.body;
    const activity = await EquipmentActivities.findByIdAndUpdate(req.params.id, { current_qa_step }, { new: true });
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id/step/:stepNumber', async (req, res) => {
  try {
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) return res.status(404).json({ message: 'Not found' });
    const step = activity.activities.find(a => a.step === parseInt(req.params.stepNumber));
    if (!step) return res.status(404).json({ message: 'Step not found' });
    res.status(200).json(step);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/step/:stepNumber', async (req, res) => {
  try {
    const { updatedStepData } = req.body;
    const activity = await EquipmentActivities.findById(req.params.id);
    const stepIndex = activity.activities.findIndex(a => a.step === parseInt(req.params.stepNumber));
    if (stepIndex === -1) return res.status(404).json({ message: 'Not found' });
    activity.activities[stepIndex] = { ...activity.activities[stepIndex], ...updatedStepData };
    await activity.save();
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/step/:stepNumber/placeholders', async (req, res) => {
  try {
    const { placeholders } = req.body;
    const activity = await EquipmentActivities.findById(req.params.id);
    const step = activity.activities.find(a => a.step === parseInt(req.params.stepNumber));
    if (!step) return res.status(404).json({ message: 'Not found' });
    step.placeholders = placeholders;
    await activity.save();
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id/total-steps', async (req, res) => {
  try {
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) return res.status(404).json({ message: 'Not found' });
    res.status(200).json({ totalSteps: activity.activities.length });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/step/:stepNumber/operator-execution', async (req, res) => {
  try {
    const { executed, executed_by, executed_at } = req.body;
    const activity = await EquipmentActivities.findById(req.params.id);
    const step = activity.activities.find(a => a.step === parseInt(req.params.stepNumber));
    if (!step) return res.status(404).json({ message: 'Not found' });
    step.operator_execution = { executed, executed_by, executed_at };
    await activity.save();
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/:id/step/:stepNumber/comments', async (req, res) => {
  try {
    const { user, text } = req.body;
    const activity = await EquipmentActivities.findById(req.params.id);
    const step = activity.activities.find(a => a.step === parseInt(req.params.stepNumber));
    if (!step) return res.status(404).json({ message: 'Not found' });
    step.comments.push({ user, text });
    await activity.save();
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/input-values', async (req, res) => {
  try {
    const { inputValues } = req.body;
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) return res.status(404).json({ message: 'Not found' });
    
    inputValues.forEach(input => {
      const stepToUpdate = activity.activities.find(instr => {
        return instr.has_placeholder && Object.keys(instr.placeholders).includes(input.key);
      });
      if (stepToUpdate && stepToUpdate.operator_execution?.executed === false) {
        stepToUpdate.placeholders[input.key].value = input.value;
      }
    });

    const result = await recalculateAutoPlaceholders(activity, inputValues);
    await result.save();
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const recalculateAutoPlaceholders = async (activity, newInputValues) => {
  try {
    const updatedPlaceholders = new Set(newInputValues.map(item => item.key));
    for (let inst of activity.activities) {
      if (inst.placeholders) {
        const placeholders = inst.placeholders instanceof Map ? Array.from(inst.placeholders.entries()) : Object.entries(inst.placeholders);
        for (let [key, placeholderData] of placeholders) {
          if (typeof placeholderData === 'object' && placeholderData.formula) {
            try {
              const formula = placeholderData.formula;
              const formulaKeys = formula.match(/\{([^}]*)\}/g).map(f => f.replace(/[{}]/g, ''));
              if (formulaKeys.some(fk => updatedPlaceholders.has(fk))) {
                const evaluatedValue = eval(formula.replace(/\{([^}]*)\}/g, (_, placeholderKey) => {
                  const found = newInputValues.find(iv => iv.key === placeholderKey);
                  return found ? found.value : `0`;
                }));
                placeholderData.value = evaluatedValue;
                activity.markModified('activities');
              }
            } catch (e) { console.error(e); }
          }
        }
      }
    }
    return activity;
  } catch (error) { console.error(error); }
};

// Get a specific activity by ID
router.get('/:id', protectRoute, async (req, res) => {
  try {
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Download approval PDF certificate
router.get('/:id/download-approval-pdf', protectRoute, pdfController.downloadApprovalPdf);

module.exports = router;