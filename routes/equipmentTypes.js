const express = require('express');
const EquipmentType = require('../models/equipmentTypeModel');
const router = express.Router();

// API to fetch all equipment types
router.get('/', async (req, res) => {
    try {
        const equipmentTypes = await EquipmentType.find({}); // Fetch all equipment types
        res.json(equipmentTypes); // Return them as JSON
    } catch (err) {
        console.error('Error fetching equipment types:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// API to add a new equipment type
router.post('/', async (req, res) => {
    const { equipment_type_name, equipment_type_properties } = req.body;

    // Validate input data
    if (
        !equipment_type_name ||
        !Array.isArray(equipment_type_properties) ||
        equipment_type_properties.some((prop) => !prop.name || !prop.value)
    ) {
        return res.status(400).json({
            message: 'Invalid input data. Each property must have a name and a value.',
        });
    }

    // Create a new EquipmentType document
    const equipmentType = new EquipmentType({
        equipment_type_name,
        equipment_type_properties,
    });

    try {
        const newEquipmentType = await equipmentType.save(); // Save the new equipment type
        res.status(201).json({ equipment_type_id: newEquipmentType._id }); // Respond with the generated _id
    } catch (err) {
        console.error('Error creating equipment type:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// API to update an existing equipment type
router.put('/:id', async (req, res) => {
    const { equipment_type_name, equipment_type_properties } = req.body;

    // Validate input data
    if (
        !equipment_type_name ||
        !Array.isArray(equipment_type_properties) ||
        equipment_type_properties.some((prop) => !prop.name || !prop.value)
    ) {
        return res.status(400).json({
            message: 'Invalid input data. Each property must have a name and a value.',
        });
    }

    try {
        const updatedEquipmentType = await EquipmentType.findByIdAndUpdate(
            req.params.id, // Use auto-incremented _id
            { equipment_type_name, equipment_type_properties },
            { new: true } // Return the updated document
        );

        if (!updatedEquipmentType) {
            return res.status(404).json({ message: 'Equipment type not found.' });
        }

        res.json(updatedEquipmentType);
    } catch (err) {
        console.error('Error updating equipment type:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// API to delete an equipment type
router.delete('/:id', async (req, res) => {
    try {
        const deletedEquipmentType = await EquipmentType.findByIdAndDelete(req.params.id); // Delete by _id

        if (!deletedEquipmentType) {
            return res.status(404).json({ message: 'Equipment type not found.' });
        }

        res.json({ message: 'Equipment type deleted successfully.' });
    } catch (err) {
        console.error('Error deleting equipment type:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// API to fetch properties of a specific equipment type
router.get('/:id/properties', async (req, res) => {
    try {
        // Find the equipment type by ID
        const equipmentType = await EquipmentType.findById(req.params.id);

        // If equipment type not found, return a 404 error
        if (!equipmentType) {
            return res.status(404).json({ message: 'Equipment type not found.' });
        }

        // Return only the properties
        res.json(equipmentType.equipment_type_properties);
    } catch (err) {
        console.error('Error fetching equipment type properties:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

router.get('/:id/equipmentTypeName', async (req, res) => {
    try {
        // Find the equipment type by ID
        const equipmentType = await EquipmentType.findById(req.params.id);

        // If equipment type not found, return a 404 error
        if (!equipmentType) {
            return res.status(404).json({ message: 'Equipment type not found.' });
        }

        // Return only the properties
        res.json(equipmentType.equipment_type_name);
    } catch (err) {
        console.error('Error fetching equipment type properties:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// API to fetch a specific equipment type by ID (must be after specific routes)
router.get('/:id', async (req, res) => {
    try {
        const equipmentType = await EquipmentType.findById(req.params.id);
        
        if (!equipmentType) {
            return res.status(404).json({ message: 'Equipment type not found.' });
        }
        
        res.json(equipmentType);
    } catch (err) {
        console.error('Error fetching equipment type by ID:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

module.exports = router;