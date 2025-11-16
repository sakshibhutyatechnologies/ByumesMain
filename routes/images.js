const express = require('express');
const multer = require('multer');
const { Image } = require('../models/imageModel');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Endpoint to upload an image (POST)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { description, name } = req.body; 
    const { buffer, mimetype } = req.file;

    const newImage = new Image({  
      description,
      name, 
      image: buffer,  
      contentType: mimetype, 
    });

    await newImage.save(); 

    res.status(201).json({ message: 'Image uploaded successfully', image: newImage });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading image', error: error.message });
  }
});


// Fetch an image by its ID (GET)
router.get('/:id', async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.set('Content-Type', image.contentType); 
    res.send(image.image); 
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving image', error: error.message });
  }
});

// Fetch all images (GET)
router.get('/', async (req, res) => {
  try {
    const images = await Image.find();
    res.json(images); 
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
