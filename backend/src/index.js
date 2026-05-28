const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const { CORS_ORIGIN, PORT, NODE_ENV } = require('./config/env');

const authRoutes        = require('./routes/auth');
const patientRoutes     = require('./routes/patients');
const doctorRoutes      = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const queueRoutes       = require('./routes/queue');
const reportRoutes      = require('./routes/reports');

const app = express();

app.use(cors({ origin: CORS_ORIGIN, credentials: false }));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth',         authRoutes);
app.use('/api/patients',     patientRoutes);
app.use('/api/doctors',      doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue',        queueRoutes);
app.use('/api/reports',      reportRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'HAQMS Backend API', status: 'Running', version: '1.0.0' });
});

app.get('/healthz', async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  } finally {
    await prisma.$disconnect();
  }
});

app.use((err, req, res, next) => {
  const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  console.error(`[ERROR ${requestId}]`, err);
  res.status(err.status || 500).json({ error: 'Internal server error', requestId });
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`   HAQMS BACKEND SERVER RUNNING ON PORT ${PORT}`);
  console.log(`   ENVIRONMENT: ${NODE_ENV}`);
  console.log(`===================================================`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});
