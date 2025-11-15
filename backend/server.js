require('dotenv').config();  // Load environment variables from .env
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./utils/db');
const path = require('path');
const DeliverySocketHandler = require('./sockets/delivery-socket');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: [
            'http://localhost:4200',
            'http://localhost:4201',
            'http://localhost:52023',
            'https://proteinsgrubhub.vercel.app'
        ],
        credentials: true
    }
});

// Initialize delivery socket handler
const deliverySocketHandler = new DeliverySocketHandler(io);
app.set('deliverySocketHandler', deliverySocketHandler);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
    origin: [
        'http://localhost:4200',
        'http://localhost:4201',
        'http://localhost:52023',
        'https://proteinsgrubhub.vercel.app'
    ],
    credentials: true
}));

// Stripe webhooks must receive the raw body; mount before JSON parsing
app.use('/api/webhooks', require('./routes/webhooks'));
// Razorpay webhooks also require raw body; mount before JSON parsing
app.use('/api/webhooks/razorpay', require('./routes/razorpay-webhook'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/email', require('./routes/email'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/delivery', require('./routes/delivery'));

// Serve static files from the Angular app
app.use(express.static(path.join(__dirname, '../frontend/dist/frontend')));

// API Health check
app.get('/api', (req, res) => {
    res.send('Protein Grub Hub API is running...');
});
app.get('/', (req, res) => res.send('API OK'));
app.use((req, res) => res.status(404).json({ ok: false, message: 'Not found' }));

// // Handle Angular routing
// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '../frontend/dist/frontend/index.html'));
// });

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Serve static files from the Angular app ONLY when explicitly enabled
if (process.env.SERVE_FRONTEND === 'true') {
  app.use(express.static(path.join(__dirname, '../frontend/dist/frontend')));
  // Handle Angular routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/frontend/index.html'));
  });
} else {
  // Health route and 404 for non-API routes
  app.get('/', (req, res) => res.send('API OK'));
  app.use((req, res) => res.status(404).json({ ok: false, message: 'Not found' }));
}

// Server Initialization
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO is ready for real-time delivery tracking`);
});