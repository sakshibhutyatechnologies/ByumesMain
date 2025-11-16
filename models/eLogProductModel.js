const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const eLogProductSchema = new mongoose.Schema({
  _id: { type: Number },
  eLog_product_name: { type: String, required: true },
  effective: { type: Boolean, required: true },
  version: { type: Number, required: true },
  equipment_activities_id: { type: Number, required: true },
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

eLogProductSchema.plugin(AutoIncrement, { id: 'eLog_product_seq', inc_field: '_id' });

const eLogProduct = mongoose.model('eLogProduct', eLogProductSchema);
module.exports = eLogProduct;