const express = require('express');
const router = express.Router();
const MasterInstruction = require('../models/masterInstructionModel');
const { User } = require('../models/userModel'); // Import the User model
const { protectRoute } = require('./authentication');
// NOTE: You must have an authentication middleware that adds the logged-in user's
// details (like role and _id) to the request object (e.g., req.user).

// NEW: API to fetch all users who can act as approvers
router.get('/users', protectRoute, async (req, res) => {
  try {
    const potentialApprovers = await User.find({ 
      role: { $in: ['Admin', 'QA', 'Supervisor'] } 
    }).select('full_name _id');
    res.json(potentialApprovers);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/', protectRoute, async (req, res) => {
  try {
    // Now you get the real user from the middleware
    const user = req.user; 
    let query = {};

    if (user.role === 'Admin' || user.role === 'Supervisor') {
      query = {};
    } else if (user.role === 'QA') {
      query = {
        $or: [
          { status: 'approved' },
          { status: 'pending', 'approvers.user_id': user._id.toString() } // Use the real user's ID
        ]
      };
    } else {
      query = { status: 'approved' };
    }
    const masterInstructions = await MasterInstruction.find(query);
    res.json(masterInstructions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch instructions' });
  }
});

// UPDATED: API to create a new instruction, now with approvers
router.post('/', async (req, res) => {
  try {
    const { product_name, instruction_name, instructions, approvers } = req.body;

    if (!approvers || approvers.length === 0) {
      return res.status(400).json({ error: 'At least one approver must be selected.' });
    }

    const newInstruction = new MasterInstruction({
      ...req.body,
      approvers: approvers, // Save the approvers from the request
      status: 'pending'     // Force the status to 'pending'
    });

    await newInstruction.save();
    res.status(201).json(newInstruction);
  } catch (err) {
    console.error('Error saving master instruction:', err);
    res.status(500).json({ error: 'Failed to save master instruction' });
  }
});
// In routes/masterInstructions.js

router.get('/productnames', async (req, res) => {
  try {
    // Make sure to select 'status' along with '_id' and 'product_name'
    const instructions = await MasterInstruction.find({})
      .select('_id product_name status'); 
      
    res.json(instructions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});
// NEW: API to approve a pending instruction
router.patch('/:id/approve', async (req, res) => {
  try {
    const updatedInstruction = await MasterInstruction.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'approved' } },
      { new: true } // This option returns the modified document
    );
    if (!updatedInstruction) {
      return res.status(404).json({ error: 'Instruction not found' });
    }
    res.json({ message: 'Instruction approved successfully!', instruction: updatedInstruction });
  } catch (err) {
    console.error('Error approving instruction:', err);
    res.status(500).json({ error: 'Failed to approve instruction' });
  }
});

// This route can remain as is for fetching a single item by ID
router.get('/:id', async (req, res) => {
  try {
    const masterInstruction = await MasterInstruction.findById(req.params.id);
    if (!masterInstruction) {
      return res.status(404).json({ error: 'Master instruction not found' });
    }
    res.json(masterInstruction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch master instruction' });
  }
});

module.exports = router;