const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const masterInstructionSchema = new mongoose.Schema({
  _id: { type: Number },
  
  // UPDATED: Changed to Mixed to accept multilingual objects {en: "...", fr: "..."}
  // This prevents the "Cast to string failed" error you saw earlier.
  product_name: { type: mongoose.Schema.Types.Mixed, required: true },

  // YOUR ORIGINAL STRUCTURE RESTORED
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
    default: 'approved' // Default 'approved' keeps old files visible
  },
  approvers: [{
    user_id: String, // Stores the User ID (Number or ObjectId)
    username: String
  }]
  // ----------------------------------------

}, { timestamps: true }); // Added timestamps to track createdAt/updatedAt

masterInstructionSchema.plugin(AutoIncrement, { id: 'master_instruction_seq', inc_field: '_id' });

const MasterInstruction = mongoose.model('MasterInstruction', masterInstructionSchema);
module.exports = MasterInstruction;