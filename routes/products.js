const express = require('express');
const Product = require('../models/productModel');
const router = express.Router();

// API to fetch all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// API to fetch a specific product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new product
router.post('/', async (req, res) => {
  const { product_name, effective, version, instruction_id, start_date, created_by } = req.body;

  const product = new Product({
    product_name,
    effective,
    version,
    instruction_id,
    start_date,
    created_by,
    status: 'active'
  });

  try {
    const newProduct = await product.save();
    res.status(201).json({ product_id: newProduct._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// API to update the effective status of a product
router.patch('/:id/effective', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.effective = true;
    product.start_date = new Date();

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update product details
router.patch('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const { product_name, effective, version, instruction_id, start_date, end_date, status, updated_by } = req.body;

    if (product_name) product.product_name = product_name;
    if (effective !== undefined) product.effective = effective;
    if (version) product.version = version;
    if (instruction_id) product.instruction_id = instruction_id;
    if (start_date) product.start_date = start_date;
    if (end_date) product.end_date = end_date;
    if (status) product.status = status;
    if (updated_by) product.updated_by = updated_by;

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Bulk fetch
router.post('/bulk', async (req, res) => {
  const { productIds } = req.body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ message: 'Invalid product IDs' });
  }

  try {
    const products = await Product.find({ _id: { $in: productIds } });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;