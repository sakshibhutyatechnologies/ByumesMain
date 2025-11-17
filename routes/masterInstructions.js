const express = require('express');
const router = express.Router();
const MasterInstruction = require('../models/masterInstructionModel'); 


router.get('/productnames', async (req, res) => {
  try {
    // We select status and approvers so the frontend can filter by tabs
    const masterInstructions = await MasterInstruction.find({}, 'product_name _id status approvers');
    res.json(masterInstructions);
  } catch (err) {
    console.error('Error fetching product names:', err);
    res.status(500).json({ error: 'Failed to fetch product names' });
  }
});

// 2. Fetch single instruction details
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


router.post('/', async (req, res) => {
  try {
    // The body now contains status: 'pending' and approvers array from the frontend
    const newInstruction = new MasterInstruction(req.body);
    await newInstruction.save();
    res.status(201).json(newInstruction);
  } catch (err) {
    console.error('Error saving master instruction:', err);
    res.status(500).json({ error: 'Failed to save master instruction' });
  }
});


router.patch('/:id/approve', async (req, res) => {
  try {
    const instruction = await MasterInstruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ message: 'Instruction not found' });

    instruction.status = 'approved';
    await instruction.save();

    res.json({ message: 'Instruction approved successfully', instruction });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;