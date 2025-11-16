const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const imageSchema = new mongoose.Schema({
  _id: {
    type: Number,
  },
  description: {
    type: String,
    required: true,
  },
  image: {
    type: Buffer, 
    required: true,
  },
  name: { 
    type: String,
    required: true,
  },
  contentType: {
    type: String, 
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now, 
  },
});

imageSchema.plugin(AutoIncrement, { id: 'image_seq', inc_field: '_id' });

const Image = mongoose.model('Image', imageSchema);

module.exports = { Image };