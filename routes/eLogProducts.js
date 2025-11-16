const express = require('express');
const eLogProduct = require('../models/eLogProductModel');
const router = express.Router();

// API to fetch all eLogProducts
router.get('/', async (req, res) => {
    try {
        const products = await eLogProduct.find({});
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// API to fetch a specific eLogProduct by ID
router.get('/:id', async (req, res) => {
    try {
        const product = await eLogProduct.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'ELog Product not found' });
        }

        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// API to add a new eLogProduct
router.post('/', async (req, res) => {
    const { eLog_product_name, effective, version, equipment_activities_id, start_date, end_date, created_by } = req.body;

    const product = new eLogProduct({
        eLog_product_name,
        effective,
        version,
        equipment_activities_id,
        start_date,
        end_date,
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

// API to update the effective status of an eLogProduct
router.patch('/:id/effective', async (req, res) => {
    try {
        const product = await eLogProduct.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        product.effective = true;
        product.start_date = new Date();
        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update product
router.patch('/:id', async (req, res) => {
    try {
        const product = await eLogProduct.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const {
            eLog_product_name,
            effective,
            version,
            equipment_activities_id,
            start_date,
            end_date,
            status,
            updated_by
        } = req.body;

        if (eLog_product_name) product.eLog_product_name = eLog_product_name;
        if (effective !== undefined) product.effective = effective;
        if (version) product.version = version;
        if (equipment_activities_id) product.equipment_activities_id = equipment_activities_id;
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

// API to fetch eLogProducts by a list of IDs
router.post('/bulk', async (req, res) => {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: 'Invalid product IDs' });
    }

    try {
        const products = await eLogProduct.find({ _id: { $in: productIds } });
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
