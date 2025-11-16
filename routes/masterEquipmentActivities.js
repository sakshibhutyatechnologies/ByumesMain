const express = require('express');
const router = express.Router();
const MasterEquipmentActivities = require('../models/masterEquipmentActivitiesModel');

router.get('/', async (req, res) => {
  try {
    const activities = await MasterEquipmentActivities.find(); // Fetch all documents
    res.json(activities);
  } catch (err) {
    console.error('Error fetching master equipment activities:', err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});


// Fetch product names and instruction IDs
router.get('/productnames', async (req, res) => {
  try {
    const activities = await MasterEquipmentActivities.find({}, 'product_name _id');
    res.json(activities);
  } catch (err) {
    console.error('Error fetching product names:', err);
    res.status(500).json({ error: 'Failed to fetch product names' });
  }
});

// Fetch a specific master equipment activity by ID
router.get('/:id', async (req, res) => {
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

// Add a new master equipment activity
router.post('/', async (req, res) => {
  try {
    const newActivity = new MasterEquipmentActivities(req.body);
    const savedActivity = await newActivity.save();
    res.status(201).json(savedActivity);
  } catch (err) {
    console.error('Error adding new activity:', err);
    res.status(500).json({ error: 'Failed to add new activity' });
  }
});

// Update an existing master equipment activity by ID
router.put('/:id', async (req, res) => {
  try {
    const updatedActivity = await MasterEquipmentActivities.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true } // Return the updated document
    );
    if (!updatedActivity) {
      return res.status(404).json({ error: 'Master equipment activity not found' });
    }
    res.json(updatedActivity);
  } catch (err) {
    console.error('Error updating activity:', err);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// Delete a specific master equipment activity by ID
router.delete('/:id', async (req, res) => {
  try {
    const deletedActivity = await MasterEquipmentActivities.findByIdAndDelete(req.params.id);
    if (!deletedActivity) {
      return res.status(404).json({ error: 'Master equipment activity not found' });
    }
    res.json({ message: 'Master equipment activity deleted successfully' });
  } catch (err) {
    console.error('Error deleting activity:', err);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

module.exports = router;