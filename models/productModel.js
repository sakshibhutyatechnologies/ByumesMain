const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

// Define the schema
const ProductSchema = new mongoose.Schema({
  _id: { type: Number },
  product_name: { type: String, required: true },
  effective: { type: Boolean, required: true },
  version: { type: Number, required: true },
  instruction_id: { type: Number, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, default: null },

  created_by: { type: String, required: false },
  updated_by: { type: String, required: false },

  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  }
}, { timestamps: true });

ProductSchema.plugin(AutoIncrement, { id: 'product_seq', inc_field: '_id' });

const Product = mongoose.model('Product', ProductSchema);
module.exports = Product;