const express = require('express');
const router = express.Router();
const MasterInstruction = require('../models/masterInstructionModel'); 

// Fetch product names and instruction IDs
router.get('/productnames', async (req, res) => {
  try {
    const masterInstructions = await MasterInstruction.find({}, 'product_name _id');
    res.json(masterInstructions);
  } catch (err) {
    console.error('Error fetching product names:', err);
    res.status(500).json({ error: 'Failed to fetch product names' });
  }
});


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
    const newInstruction = new MasterInstruction(req.body);
    await newInstruction.save();
    res.status(201).json(newInstruction);
  } catch (err) {
    console.error('Error saving master instruction:', err);
    res.status(500).json({ error: 'Failed to save master instruction' });
  }
});

module.exports = router;