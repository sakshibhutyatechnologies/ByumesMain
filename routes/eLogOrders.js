const express = require('express');
const router = express.Router();
const eLogOrder = require('../models/eLogOrderModel');

// Get all orders
router.get('/', async (req, res) => {
    try {
        const eLogOrders = await eLogOrder.find({});
        res.json(eLogOrders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// API to fetch a specific eLog order by ID
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);

        const eLogOrderDetails = await eLogOrder.findById(id);

        if (!eLogOrderDetails) {
            return res.status(404).json({ message: 'ELogOrder not found' });
        }

        res.json(eLogOrderDetails);
    } catch (err) {
        console.error('Error fetching eLogOrders:', err);
        res.status(500).json({ message: err.message });
    }
});

// Create new order
router.post('/', async (req, res) => {
    const { eLogOrder_name, eLogProducts, equipmentInfo, created_by } = req.body;

    if (
        !eLogOrder_name ||
        !Array.isArray(eLogProducts) ||
        eLogProducts.length === 0 ||
        !equipmentInfo ||
        typeof equipmentInfo.equipment_type_id !== 'number' ||
        typeof equipmentInfo.equipment_id !== 'number' ||
        typeof equipmentInfo.equipment_name !== 'string'
    ) {
        return res.status(400).json({ message: 'Invalid input data' });
    }

    const order = new eLogOrder({
        eLogOrder_name,
        eLogProducts,
        equipmentInfo,
        created_by,
        status: 'active'
    });

    try {
        const newOrder = await order.save();
        res.status(201).json({ order_id: newOrder._id });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update order
router.patch('/:id', async (req, res) => {
    try {
        const order = await eLogOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const { eLogOrder_name, eLogProducts, equipmentInfo, status, updated_by } = req.body;

        if (eLogOrder_name) order.eLogOrder_name = eLogOrder_name;
        if (eLogProducts) order.eLogProducts = eLogProducts;
        if (equipmentInfo) order.equipmentInfo = equipmentInfo;
        if (status) order.status = status;
        if (updated_by) order.updated_by = updated_by;

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;