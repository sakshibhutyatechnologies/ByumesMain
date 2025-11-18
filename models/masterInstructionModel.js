const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

// Define the schema for an individual approver
const ApproverSchema = new mongoose.Schema({
  user_id: {
    type: String, // This should reference the _id from your User model
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  }
}, { _id: false }); // Don't create a separate _id for each approver object

// Your original master instruction schema with the new fields added
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
  ],
  // --- NEW FIELDS FOR APPROVAL WORKFLOW ---
  status: {
    type: String,
    enum: ['pending', 'approved'],
    default: 'pending' // New instructions will be 'pending'
  },
  approvers: [ApproverSchema] // Array of selected approvers
});

masterInstructionSchema.plugin(AutoIncrement, { id: 'master_instruction_seq', inc_field: '_id' });

const MasterInstruction = mongoose.model('MasterInstruction', masterInstructionSchema);
module.exports = MasterInstruction;