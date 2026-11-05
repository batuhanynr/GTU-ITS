import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './config/prisma.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import gradingRoutes from './routes/gradingRoutes.js';
import internshipRoutes from './routes/internshipRoutes.js';

// Load environment variables
dotenv.config();

// Create express app
const app = express();

// Middleware
app.use(cors()); 
app.use(express.json());

// Make prisma available to all routes via req.app.locals
app.locals.prisma = prisma;

// API Routes
app.get('/', (req, res) => {
    res.send('Staj Takip Sistemi Back-end (PostgreSQL + Prisma) Çalışıyor! 🚀');
});

// A release is healthy only when its database is reachable.
app.get('/api/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok' });
    } catch {
        res.status(503).json({ status: 'unavailable' });
    }
});

// Mount routes
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', departmentRoutes);
app.use('/api', studentRoutes);
app.use('/api', gradingRoutes);
app.use('/api', internshipRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Bir şeyler yanlış gitti!' });
});

export default app;
