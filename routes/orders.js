const express = require('express');
const Order = require('../models/orderModel');
const router = express.Router();

// Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find({});
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get order by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ message: err.message });
  }
});

// Create new order
router.post('/', async (req, res) => {
  const { order_name, products, created_by } = req.body;

  if (!order_name || !Array.isArray(products)) {
    return res.status(400).json({ message: 'Invalid input data' });
  }

  const order = new Order({
    order_name,
    products,
    created_by,
    status: 'active'
  });

  try {
    const newOrder = await order.save();
    res.status(201).json({ order_id: newOrder._id });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update order status or metadata (optional route)
router.patch('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const { order_name, products, status, updated_by } = req.body;
    if (order_name) order.order_name = order_name;
    if (products) order.products = products;
    if (status) order.status = status;
    if (updated_by) order.updated_by = updated_by;

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;