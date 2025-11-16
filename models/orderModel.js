const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const orderSchema = new mongoose.Schema({
    _id: {
        type: Number,
    },
    order_name: {
        type: String,
        required: true
    },
    products: [
        {
            type: Number,
            required: true
        }
    ],
     // Optional audit fields
        created_by: { type: String, required: false },
        updated_by: { type: String, required: false },

        // Status management
        status: {
            type: String,
            enum: ['active', 'inactive', 'archived'],
            default: 'active'
        }
}, { timestamps: true });

orderSchema.plugin(AutoIncrement, { id: 'order_seq', inc_field: '_id' });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;