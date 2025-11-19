const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const ROLES = ['Admin', 'Supervisor', 'Operator', 'QA', 'Approver', 'Reviewer'];
const LANGUAGES = ['en', 'fr', 'es', 'de', 'hi'];
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/Berlin',
];
const STATUSES = ['active', 'suspended', 'pending'];

const userSchema = new mongoose.Schema({
  userId: { type: Number },
  loginId: { type: String, required: true, unique: true },
  full_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'Operator' },
  language: { type: String, enum: LANGUAGES, default: 'en' },
  timezone: { type: String, enum: TIMEZONES, default: 'UTC' },
  status: { type: String, enum: STATUSES, default: 'pending' },
  last_login_at: { type: Date, default: null },
  profile_picture_url: { type: String, default: '' },
  companyId: { type: Number, ref: 'Company' },
  loginTime: { type: Date, default: null },
  logoutTime: { type: Date, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Apply auto-increment plugin on _id
userSchema.plugin(AutoIncrement, { inc_field: 'userId', id: 'user_seq' });

module.exports = {
  User: mongoose.model('User', userSchema),
  ROLES,
  LANGUAGES,
  TIMEZONES,
  STATUSES
};