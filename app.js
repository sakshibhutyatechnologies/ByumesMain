require('dotenv').config({ path: `.env.${process.env.APP_ENV || 'development'}` });
const path = require('path');
const fs = require('fs');
const https = require('https');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const configuration = require('./configuration.js');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 4000;

// Debug environment variables
console.log(`Using .env file: .env.${process.env.APP_ENV || 'development'}`);
console.log(`CORS Origin: ${process.env.CORS_ORIGIN}`);
console.log(`Mongo URI: ${configuration.MONGO_URI}`);

//app.use(cors());
// Allow multiple origins for network access
const allowedOrigins = [
    'https://127.0.0.1:3000',
    'https://localhost:3000',
    `https://${require('os').hostname()}:3000`,
    // Allow any origin on the same network (for development)
    /^https:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/,
    /^https:\/\/[a-zA-Z0-9-]+:3000$/  // Allow any hostname
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Check if origin matches any allowed pattern
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return allowed === origin;
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            console.log(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
}));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Connect to MongoDB
mongoose.connect(configuration.MONGO_URI, {
    maxPoolSize: 10
})
    .then(() => {
        console.log('Connected to MongoDB');

        const userRoutes = require('./routes/users');
        const orderRoutes = require('./routes/orders');
        const productRoutes = require('./routes/products');
        const instructionRoutes = require('./routes/instructions');
        const masterInstructionRoutes = require('./routes/masterInstructions');
        const reports = require('./routes/reports');
        const equipmentTypes = require('./routes/equipmentTypes');
        const equipments = require('./routes/equipments');
        const equipmentActivities = require('./routes/equipmentActivities');
        const masterEquipmentActivities = require('./routes/masterEquipmentActivities');
        const eLogOrders = require('./routes/eLogOrders');
        const eLogProducts = require('./routes/eLogProducts');
        const eLogReports = require('./routes/eLogReports');
        const images = require('./routes/images');
        const gifs = require('./routes/gifs');
        const docToJsonRoute = require('./routes/docToJson');
        const docToJsonForElogRoute = require('./routes/docToJsonForElog');
        // const authenticationRoutes = require('./routes/authentication');
        const companies = require('./routes/companies');
        const { authRouter } = require('./routes/authentication');
        // Use routes
        app.use('/users', userRoutes);
        app.use('/orders', orderRoutes);
        app.use('/products', productRoutes);
        app.use('/instructions', instructionRoutes);
        app.use('/masterInstructions', masterInstructionRoutes);
        app.use('/reports', reports);
        app.use('/eLogReports', eLogReports);
        app.use('/equipmentTypes', equipmentTypes);
        app.use('/equipments', equipments);
        app.use('/equipmentActivities', equipmentActivities);
        app.use('/masterEquipmentActivities', masterEquipmentActivities);
        app.use('/eLogOrders', eLogOrders);
        app.use('/eLogProducts', eLogProducts);
        app.use('/images', images);
        app.use('/gifs', gifs);
        app.use('/docToJson', docToJsonRoute);
        app.use('/docToJsonForElog', docToJsonForElogRoute);

        app.use('/companies', companies);
        app.use('/api/auth', authRouter);

        // Load SSL certificates
        const httpsOptions = {
            key: fs.readFileSync(path.join(__dirname, 'certs', 'server.key')),
            cert: fs.readFileSync(path.join(__dirname, 'certs', 'server.cert'))
        };

        // Start the HTTPS server
        https.createServer(httpsOptions, app).listen(port, '0.0.0.0', () => {
            console.log(`HTTPS Server is running on https://0.0.0.0:${port}`);
            console.log(`Access locally: https://127.0.0.1:${port}`);
            console.log(`Access on network: https://<your-ip>:${port}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    });