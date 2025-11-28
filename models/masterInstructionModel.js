const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const ApproverSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  username: { type: String, required: true }
}, { _id: false });

const ReviewerSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  username: { type: String, required: true }
}, { _id: false });

// --- NEW: Schema to store old versions ---
const HistorySchema = new mongoose.Schema({
  version: Number,
  doc_path: String,
  rejection_reason: String,
  rejected_by: String,
  rejected_at: Date,
  archived_at: { type: Date, default: Date.now }
}, { _id: false });

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
    // ... (your instructions schema) ...
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
  status: {
    type: String,
    enum: ['Created', 'Under Review', 'Pending for approval', 'Approved'],
    default: 'Created'
  },
  reviewers: [ReviewerSchema], 
  approvers: [ApproverSchema],
  original_doc_path: { type: String, required: false },
  rejection_info: {
    reason: String,
    rejected_by: String,
    rejected_at: Date
  },
  review_note: { type: String, default: '' },

  // --- NEW FIELDS FOR VERSIONING ---
  version: { type: Number, default: 1 },
  history: [HistorySchema] 
});

masterInstructionSchema.plugin(AutoIncrement, { id: 'master_instruction_seq', inc_field: '_id' });

const MasterInstruction = mongoose.model('MasterInstruction', masterInstructionSchema);
module.exports = MasterInstruction;