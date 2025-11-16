const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const equipmentTypeSchema = new mongoose.Schema({
    _id: {
        type: Number,
    },
    equipment_type_name: {
        type: String,
        required: true
    },
    equipment_type_properties: [
        {
            name: { type: String, required: true }, 
            value: { type: String, required: true } 
        }
    ]
});

equipmentTypeSchema.plugin(AutoIncrement, { id: 'equipment_type_seq', inc_field: '_id' });

const EquipmentType = mongoose.model('EquipmentType', equipmentTypeSchema);
module.exports = EquipmentType;
