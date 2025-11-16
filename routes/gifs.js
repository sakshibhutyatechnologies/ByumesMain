const express = require('express');
const multer = require('multer');
const { Gif } = require('../models/gifModel');
const router = express.Router();

// Configure multer to store files in memory
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('gif'), async (req, res) => { 
  try {
    const { description, name } = req.body;
    const { buffer, mimetype } = req.file;

    if (!req.file) {
      return res.status(400).json({ message: 'GIF file is required.' });
    }
    
    const newGif = new Gif({
      description,
      name,
      gif: buffer,
      contentType: mimetype,
    });

    await newGif.save();
    res.status(201).json({ message: 'GIF uploaded successfully', gif: newGif });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading GIF', error: error.message });
  }
});

module.exports = router;


// Fetch a GIF by its ID (GET)
router.get('/:id', async (req, res) => {
  try {
    const gif = await Gif.findById(req.params.id);
    if (!gif) {
      return res.status(404).json({ message: 'GIF not found' });
    }

    res.set('Content-Type', gif.contentType);
    res.send(gif.gif);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving GIF', error: error.message });
  }
});

// Fetch all GIFs (GET)
router.get('/', async (req, res) => {
  try {
    const gifs = await Gif.find();
    res.json(gifs);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
