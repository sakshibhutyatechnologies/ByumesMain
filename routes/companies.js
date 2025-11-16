// routes/companies.js
const express = require('express');
const Company = require('../models/companyModel');
const router = express.Router();

// Create a new company
router.post('/create', async (req, res) => {
  const { name, industry, subscription_plan } = req.body;
  try {
    const company = new Company({ name, industry, subscription_plan });
    await company.save();
    res.status(201).json({ message: 'Company created', company });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// GET all companies
router.get('/', async (req, res) => {
  try {
    const companies = await Company.find();
    res.json(companies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;