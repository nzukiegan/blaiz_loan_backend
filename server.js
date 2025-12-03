require('dotenv').config();
require('./services/cronJob');
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const mpesaRoutes = require('./routes/mpes');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const usersRoutes = require('./routes/users');
const loansRoutes = require('./routes/loans');
const dashBoardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notification');
const paymentsRoutes = require('./routes/payments');
const penaltiesRoutes = require('./routes/penalties');
const PORT = process.env.PORT;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(cors());
app.use(express.json());
app.use('/api/users', usersRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/dashboard', dashBoardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/penalties', penaltiesRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Blair Loans Backend is running!' });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});