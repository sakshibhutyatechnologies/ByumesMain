#!/usr/bin/env node

/**
 * scripts/seedDefaultUsers.js
 *
 * Automatically seeds three default users (admin, operator, QA) into the database.
 * Reads passwords from environment variables (no prompts).
 *
 * Requires in your .env:
 *   MONGO_URI               // MongoDB connection string
 *   ADMIN_PASSWORD          // Password for loginId "admin"
 *   OPERATOR_PASSWORD       // Password for loginId "operator"
 *   QA_PASSWORD             // Password for loginId "qa"
 *   BCRYPT_SALT_ROUNDS      // (optional, default 10)
 */

require('dotenv').config({
  path: `.env.${process.env.APP_ENV || 'development'}`
});
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('../models/userModel');

const {
  MONGO_URI,
  ADMIN_PASSWORD,
  OPERATOR_PASSWORD,
  QA_PASSWORD,
  BCRYPT_SALT_ROUNDS = '10'
} = process.env;

if (!MONGO_URI || !ADMIN_PASSWORD || !OPERATOR_PASSWORD || !QA_PASSWORD) {
  console.error('Error: Missing one or more required env variables: MONGO_URI, ADMIN_PASSWORD, OPERATOR_PASSWORD, QA_PASSWORD');
  process.exit(1);
}

const SALT_ROUNDS = parseInt(BCRYPT_SALT_ROUNDS, 10) || 10;

const defaults = [
  { 
    loginId: 'SuperUserAdmin',    
    full_name: 'Super Buymes Admin', 
    email: 'admin@example.com',    
    role: 'Admin',    
    password: ADMIN_PASSWORD 
  },
  { 
    loginId: 'SuperOperator', 
    full_name: 'Super Buymes Operator',  
    email: 'operator@example.com', 
    role: 'Operator', 
    password: OPERATOR_PASSWORD 
  },
  { loginId: 'SuperQA',       
    full_name: 'Super Buymes QA',        
    email: 'qa@example.com',       
    role: 'QA',       
    password: QA_PASSWORD 
  }
];


// Ensures default users exist. Skips any that already exist.
async function seedDefaultUsers() {
  // Connect to MongoDB
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  try {
    for (const userDef of defaults) {
      const exists = await User.findOne({
        $or: [
          { loginId: userDef.loginId },
          { email: userDef.email }
        ]
      });
      if (exists) {
        console.log(
          `[seed] ${userDef.loginId} (userId ${exists.userId}) or email ${userDef.email} already exists, skipping.`
        );
        continue;
      }

      // Hash and save new user
      const hashed = await bcrypt.hash(userDef.password, SALT_ROUNDS);
      const newUser = new User({
        loginId: userDef.loginId,
        full_name: userDef.full_name,
        email: userDef.email,
        password: hashed,
        role: userDef.role,
        status: 'active'
      });
      await newUser.save();
      console.log(`[seed] Created ${userDef.loginId} (userId ${newUser.userId}).`);
    }
    console.log('All default users seeded successfully.');
  } catch (err) {
    console.error('Seeding error:', err);
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// If script is run directly, execute seeding once
if (require.main === module) {
  seedDefaultUsers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedDefaultUsers;