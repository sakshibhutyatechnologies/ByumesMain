const express = require('express');
const router = express.Router();
const MasterInstruction = require('../models/masterInstructionModel'); 

// 1. FETCH PRODUCTS LIST
router.get('/productnames', async (req, res) => {
  try {
    // FIX: We removed the specific string 'product_name _id status...'
    // We now just use find({}) to return the FULL document.
    // This guarantees the _id is included.
    const masterInstructions = await MasterInstruction.find({});
    
    res.json(masterInstructions);
  } catch (err) {
    console.error('Error fetching product names:', err);
    res.status(500).json({ error: 'Failed to fetch product names' });
  }
});

// ... (Keep the rest of your routes: GET /:id, POST /, PATCH /:id/approve below) ...
// 2. Fetch single instruction
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

// 3. Upload new instruction
router.post('/', async (req, res) => {
  try {
    const newInstruction = new MasterInstruction(req.body);
    await newInstruction.save();
    res.status(201).json(newInstruction);
  } catch (err) {
    console.error('Error saving master instruction:', err);
    res.status(500).json({ error: 'Failed to save master instruction: ' + err.message });
  }
});

// 4. APPROVE ROUTE
router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    // SAFETY CHECK: If ID is missing or weird
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: "Invalid Product ID provided." });
    }

    const instruction = await MasterInstruction.findById(id);
    
    if (!instruction) {
      return res.status(404).json({ message: 'Instruction not found in DB' });
    }

    instruction.status = 'approved';
    await instruction.save();

    res.json({ message: 'Instruction approved successfully', instruction });
  } catch (err) {
    console.error("Approval Error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;