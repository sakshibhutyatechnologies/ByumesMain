const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const equipmentActivitiesSchema = new mongoose.Schema({
  _id: { type: Number },
  product_name: { type: String, required: true },
  activity_name: {
    en: { type: String, required: true },
    fr: { type: String },
    hi: { type: String },
    de: { type: String },
    es: { type: String }
  },
  current_step: { type: Number, default: 1 },
  current_qa_step: { type: Number, default: 1 },
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
      has_placeholder: { type: Boolean, default: false },
      operator_execution: {
        executed: { type: Boolean, default: false },
        executed_by: { type: String, default: '' },
        executed_at: { type: Date }
      },
      qa_execution: {
        qa_executed: { type: Boolean, default: false },
        qa_executed_by: { type: String, default: '' },
        qa_executed_at: { type: Date }
      },
      skip_step: { 
        skip_step: { type: Boolean, default: false }, 
        skip_step_numbers: { type: [Number], default: [] }
      },
      comments: [
        {
          user: { type: String, required: true },
          text: { type: String, required: true }, 
          created_at: { type: Date, default: Date.now } 
        }
      ]
    }
  ]
});

equipmentActivitiesSchema.plugin(AutoIncrement, { id: 'equipment_activities_seq', inc_field: '_id' });

const EquipmentActivities = mongoose.model('EquipmentActivities', equipmentActivitiesSchema);

module.exports = EquipmentActivities;

