const mongoose = require('mongoose');
const { version } = require('pdfkit');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const equipmentSchema = new mongoose.Schema({
    _id: {
        type: Number,
    },
    equipment_type_id: {  type: Number, }, 
    equipment_name: {
        type: String,
        required: true
    },
    equipment_properties: [
        {
            name: { type: String, required: true }, 
            value: { type: String, required: true } 
        }
    ],
    effective: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
});

equipmentSchema.plugin(AutoIncrement, { id: 'equipment_seq', inc_field: '_id' });

const Equipment = mongoose.model('Equipment', equipmentSchema);
module.exports = Equipment;
