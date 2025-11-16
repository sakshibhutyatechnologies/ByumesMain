const express = require('express');
const Equipment = require('../models/equipmentModel');
const router = express.Router();
const mongoose = require('mongoose');

// Create a new equipment
router.post('/', async (req, res) => {
    const { equipment_type_id, equipment_name, equipment_properties } = req.body;

    // Validate input
    if (
        !equipment_type_id ||
        !equipment_name ||
        !Array.isArray(equipment_properties) ||
        equipment_properties.some((prop) => !prop.name || !prop.value)
    ) {
        return res.status(400).json({
            message: 'Invalid input data. Provide valid type ID, name, and properties.',
        });
    }

    const equipment = new Equipment({
        equipment_type_id,
        equipment_name,
        equipment_properties,
    });

    try {
        const newEquipment = await equipment.save();
        res.status(201).json({ equipment_id: newEquipment._id });
    } catch (err) {
        console.error('Error creating equipment:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

router.get('/equipment-type/:id', async (req, res) => {
    try {
        const typeId = mongoose.Types.ObjectId.isValid(req.params.id)
            ? mongoose.Types.ObjectId(req.params.id)
            : req.params.id; // Use as-is if it's not a valid ObjectId

        const equipmentList = await Equipment.find({ equipment_type_id: typeId });
        if (!equipmentList.length) {
            return res.status(404).json({ message: 'No equipment found for the given type.' });
        }
        res.json(equipmentList);
    } catch (err) {
        console.error('Error fetching equipment by type ID:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        // Validate if the provided ID is a valid ObjectId
        const equipmentId = mongoose.Types.ObjectId.isValid(req.params.id)
            ? mongoose.Types.ObjectId(req.params.id)
            : req.params.id;

        // Find equipment by _id
        const equipment = await Equipment.findById(equipmentId);

        if (!equipment) {
            return res.status(404).json({ message: 'No equipment found for the given ID.' });
        }

        res.json(equipment);
    } catch (err) {
        console.error('Error fetching equipment by ID:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// API to fetch all equipment 
router.get('/', async (req, res) => {
    try {
        const equipments= await Equipment.find({}); // Fetch all equipment 
        res.json(equipments); // Return them as JSON
    } catch (err) {
        console.error('Error fetching equipment types:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// Update equipment (increments version & updates properties)
router.put('/:id', async (req, res) => {
    const { equipment_name, equipment_properties } = req.body;

    if (!Array.isArray(equipment_properties) || equipment_properties.some(prop => !prop.name || !prop.value)) {
        return res.status(400).json({ message: 'Invalid properties format.' });
    }

    try {
        const equipment = await Equipment.findById(req.params.id);
        if (!equipment) {
            return res.status(404).json({ message: 'Equipment not found.' });
        }

        // Increment version and update properties
        equipment.version = (equipment.version || 0) + 1;
        equipment.equipment_name = equipment_name || equipment.equipment_name;
        equipment.equipment_properties = equipment_properties;

        const updatedEquipment = await equipment.save();
        res.json({ message: 'Equipment updated successfully.', updatedEquipment });
    } catch (err) {
        console.error('Error updating equipment:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// Soft delete (set `effective` to `false`)
router.delete('/:id', async (req, res) => {
    try {
        const equipment = await Equipment.findById(req.params.id);
        if (!equipment) {
            return res.status(404).json({ message: 'Equipment not found.' });
        }

        equipment.effective = false; // Soft delete
        await equipment.save();

        res.json({ message: 'Equipment deleted successfully (soft delete).' });
    } catch (err) {
        console.error('Error deleting equipment:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

module.exports = router;
