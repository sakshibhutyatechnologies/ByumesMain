const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const masterEquipmentActivitiesSchema = new mongoose.Schema({
  _id: { type: Number },
  product_name: { type: String, required: true },
  activity_name: {
    en: { type: String, required: true },
    fr: { type: String },
    hi: { type: String },
    de: { type: String },
    es: { type: String }
  },
  activities: [
    {
      step: { type: Number, required: true },
      activity: {
        en: { type: String, required: true },
        fr: { type: String },
        hi: { type: String },
        de: { type: String },
        es: { type: String }
      },
      placeholders: {
        type: Map,
        of: new mongoose.Schema({
          type: {
            type: String,
            enum: ['textbox', 'dropdown', 'radio', 'auto', 'hyperlink', 'date', 'time', 'datetime', 'image', 'gif', 'checkbox'],
            default: 'textbox'
          },
          default: { type: String, default: '' },
          value: { type: String, default: '' },
          options: [String],  
          formula: { type: String }
        })
      },
      has_placeholder: { type: Boolean, default: false }
    }
  ]
});

masterEquipmentActivitiesSchema.plugin(AutoIncrement, { id: 'master_equipment_activities_seq', inc_field: '_id' });

const MasterEquipmentActivities = mongoose.model('MasterEquipmentActivities', masterEquipmentActivitiesSchema);
module.exports = MasterEquipmentActivities;

