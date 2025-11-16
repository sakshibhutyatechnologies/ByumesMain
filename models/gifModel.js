const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const gifSchema = new mongoose.Schema({
  _id: {
    type: Number,
  },
  description: {
    type: String,
    required: true,
  },
  name: { 
    type: String,
    required: true,
  },
  gif: {
    type: Buffer,  
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

gifSchema.plugin(AutoIncrement, { id: 'gif_seq', inc_field: '_id' });

const Gif = mongoose.model('Gif', gifSchema);

module.exports = { Gif };
