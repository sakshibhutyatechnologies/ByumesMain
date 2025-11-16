const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const eLogOrderSchema = new mongoose.Schema({
  _id: { type: Number },
  eLogOrder_name: { type: String, required: true },
  eLogProducts: [{ type: Number, required: true }],
  equipmentInfo: {
    equipment_id: { type: Number, required: true },
    equipment_type_id: { type: Number, required: true },
    equipment_name: { type: String, required: true }
  },
  created_by: { type: String, required: false },
  updated_by: { type: String, required: false },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  }
}, { timestamps: true });

eLogOrderSchema.plugin(AutoIncrement, { id: 'eLog_order_seq', inc_field: '_id' });

const eLogOrder = mongoose.model('eLogOrder', eLogOrderSchema);
module.exports = eLogOrder;