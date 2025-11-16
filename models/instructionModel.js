const mongoose = require('mongoose');
const mongooseSequence = require('mongoose-sequence')(mongoose);

const instructionSchema = new mongoose.Schema({
  _id: { type: Number },
  instruction_name: {
    en: { type: String, required: true },
    fr: { type: String},
    hi: { type: String},
    de: { type: String },
    es: { type: String }
  },
  current_step: { type: Number, default: 1 },
  current_qa_step: { type: Number, default: 1 },
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
        of: {
          type: {
            type: String,
            enum: ['textbox', 'dropdown', 'radio', 'auto', 'hyperlink', 'date', 'time', 'datetime', 'image', 'gif', 'checkbox'],
            default: 'textbox'
          },
          default: { type: String, default: '' },
          value: { type: String, default: '' },
          options: [String], 
          from_step: { type: Number }, 
          formula: { type: String } 
        }
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
        skip_step: { type: Boolean, default: false }, // Indicates if skipping is enabled
        skip_step_numbers: { type: [Number], default: [] } // List of steps to skip
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

instructionSchema.plugin(mongooseSequence, { id: 'instruction_seq', inc_field: '_id' });
const Instruction = mongoose.model('Instruction', instructionSchema);

module.exports = Instruction;
