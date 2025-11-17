const mongoose = require('mongoose');

const masterInstructionSchema = new mongoose.Schema({
  // CHANGED: Using 'Mixed' allows it to accept the multilingual object { en: "...", hi: "..." }
  product_name: { type: mongoose.Schema.Types.Mixed, required: true },
  
  // CHANGED: Using 'Mixed' here too
  instruction_name: { type: mongoose.Schema.Types.Mixed },
  
  instructions: Array, 
  
  // These are the new fields for the Approval Process
  status: { 
    type: String, 
    enum: ['pending', 'approved'], 
    default: 'approved'
  },
  approvers: [{
    user_id: String,
    username: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('MasterInstruction', masterInstructionSchema);