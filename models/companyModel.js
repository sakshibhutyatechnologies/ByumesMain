const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const companySchema = new mongoose.Schema({
  _id: { type: Number },
  name: { type: String, required: true, unique: true },
  industry: { type: String },
  subscription_plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  created_at: { type: Date, default: Date.now }
});

// ✅ This adds the auto-increment plugin for _id field
companySchema.plugin(AutoIncrement, { id: 'company_seq', inc_field: '_id' });

const Company = mongoose.model('Company', companySchema);
module.exports = Company;
