const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const masterInstructionSchema = new mongoose.Schema({
  _id: { type: Number },
  product_name: { type: String, required: true },
  instruction_name: {
    en: { type: String, required: true },
    fr: { type: String },
    hi: { type: String },
    de: { type: String },
    es: { type: String }
  },
  instructions: [
    {
      step: { type: Number, required: true },
      instruction: {
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

masterInstructionSchema.plugin(AutoIncrement, { id: 'master_instruction_seq', inc_field: '_id' });

const MasterInstruction = mongoose.model('MasterInstruction', masterInstructionSchema);
module.exports = MasterInstruction;

