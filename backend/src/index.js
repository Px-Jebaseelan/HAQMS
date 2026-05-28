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

// Configure allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://frontend-fawn-one-39.vercel.app'
];

if (CORS_ORIGIN) {
  CORS_ORIGIN.split(',').forEach(origin => {
    const trimmed = origin.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.includes(origin) || 
                      allowedOrigins.includes('*') ||
                      origin.startsWith('http://localhost:') || 
                      origin.endsWith('.vercel.app');
                      
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));
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

// Auto-seed database if empty
async function seedDatabaseIfEmpty() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[AUTO-SEED] Database is empty. Seeding initial data...');
      
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash('password123', 10);

      // 1. Create Admin
      await prisma.user.create({
        data: { email: 'admin@haqms.com', password: passwordHash, name: 'Alice Admin', role: 'ADMIN' }
      });

      // 2. Create Receptionist
      await prisma.user.create({
        data: { email: 'reception1@haqms.com', password: passwordHash, name: 'Riley Reception', role: 'RECEPTIONIST' }
      });

      // 3. Create Doctors
      const doctorSeeds = [
        { email: 'doctor1@haqms.com', name: 'Dr. Gregory House',   spec: 'Diagnostics',    dept: 'Internal Medicine', fee: 250, exp: 18 },
        { email: 'doctor2@haqms.com', name: 'Dr. Meredith Grey',   spec: 'General Surgery', dept: 'Surgery',           fee: 320, exp: 12 },
        { email: 'doctor3@haqms.com', name: 'Dr. Derek Shepherd',  spec: 'Neurology',       dept: 'Surgery',           fee: 400, exp: 22 },
        { email: 'doctor4@haqms.com', name: 'Dr. Cristina Yang',   spec: 'Cardiothoracics', dept: 'Surgery',           fee: 380, exp: 15 },
      ];

      const createdDoctors = [];
      for (const d of doctorSeeds) {
        const u = await prisma.user.create({
          data: {
            email: d.email,
            password: passwordHash,
            name: d.name,
            role: 'DOCTOR',
            doctor: {
              create: {
                name: d.name,
                specialization: d.spec,
                department: d.dept,
                experience: d.exp,
                consultationFee: d.fee,
              }
            }
          },
          include: { doctor: true }
        });
        createdDoctors.push(u.doctor);
      }

      // 4. Create Patients
      const patientSeeds = [
        { name: 'Bruce Wayne',      phoneNumber: '555-0101', age: 38, gender: 'Male',   medicalHistory: null },
        { name: 'Clark Kent',       phoneNumber: '555-0102', age: 35, gender: 'Male',   medicalHistory: null },
        { name: 'Diana Prince',     phoneNumber: '555-0103', age: 32, gender: 'Female', medicalHistory: 'Mild asthma. Allergic to penicillin.' },
        { name: 'Peter Parker',     phoneNumber: '555-0104', age: 24, gender: 'Male',   medicalHistory: 'Frequent fractures. Elevated metabolism. Monitoring required.' },
        { name: 'Natasha Romanoff', phoneNumber: '555-0105', age: 36, gender: 'Female', medicalHistory: null },
        { name: 'Tony Stark',       phoneNumber: '555-0106', age: 49, gender: 'Male',   medicalHistory: 'Arc-reactor implant. Cardiac monitoring required. No MRI.' },
        { name: 'Steve Rogers',     phoneNumber: '555-0107', age: 105, gender: 'Male',  medicalHistory: 'Super-soldier serum recipient. Enhanced healing. No standard medication doses.' },
        { name: 'Wanda Maximoff',   phoneNumber: '555-0108', age: 30, gender: 'Female', medicalHistory: null },
      ];

      const patients = [];
      for (const p of patientSeeds) {
        patients.push(await prisma.patient.create({ data: p }));
      }

      // 5. Create Appointments
      const now = new Date();
      const appointmentSeeds = [
        { patientIdx: 0, doctorIdx: 0, offsetDays: 0,  offsetHours: 9,  reason: 'Initial diagnostic consultation' },
        { patientIdx: 1, doctorIdx: 0, offsetDays: 0,  offsetHours: 10, reason: 'Follow-up – chest pain' },
        { patientIdx: 2, doctorIdx: 1, offsetDays: 0,  offsetHours: 11, reason: 'Pre-op clearance' },
        { patientIdx: 3, doctorIdx: 2, offsetDays: 1,  offsetHours: 9,  reason: 'Neurological assessment' },
        { patientIdx: 4, doctorIdx: 3, offsetDays: -1, offsetHours: 14, reason: 'Cardiac stress test review', status: 'COMPLETED' },
        { patientIdx: 5, doctorIdx: 0, offsetDays: -2, offsetHours: 10, reason: 'Arc-reactor biocompatibility check', status: 'COMPLETED' },
        { patientIdx: 6, doctorIdx: 1, offsetDays: 2,  offsetHours: 13, reason: 'Routine check-up' },
      ];

      for (const a of appointmentSeeds) {
        const apptDate = new Date(now);
        apptDate.setDate(apptDate.getDate() + a.offsetDays);
        apptDate.setHours(a.offsetHours, 0, 0, 0);
        const doc = createdDoctors[a.doctorIdx];
        const pat = patients[a.patientIdx];
        if (!doc || !pat) continue;
        await prisma.appointment.create({
          data: {
            patientId: pat.id,
            doctorId: doc.id,
            appointmentDate: apptDate,
            reason: a.reason,
            status: a.status || 'PENDING',
          }
        });
      }

      console.log('[AUTO-SEED] Seeding completed successfully!');
    } else {
      console.log('[AUTO-SEED] Database already has data. Skipping seeding.');
    }
  } catch (err) {
    console.error('[AUTO-SEED] Error checking or seeding database:', err);
  } finally {
    await prisma.$disconnect();
  }
}

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`   HAQMS BACKEND SERVER RUNNING ON PORT ${PORT}`);
  console.log(`   ENVIRONMENT: ${NODE_ENV}`);
  console.log(`===================================================`);
  seedDatabaseIfEmpty();
});

process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});
