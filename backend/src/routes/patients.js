const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/patients
router.get('/', authenticate, async (req, res) => {
  try {
    const search = (req.query.search || '').toString().trim();
    const gender = (req.query.gender || 'All').toString();
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip   = (page - 1) * limit;

    const where = {
      ...(gender !== 'All' && { gender }),
      ...(search && {
        OR: [
          { name:        { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search } },
          { email:       { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [patients, totalPatients] = await prisma.$transaction([
      prisma.patient.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.patient.count({ where }),
    ]);

    res.json({
      success: true,
      patients,
      pagination: {
        page,
        limit,
        totalPatients,
        totalPages: Math.ceil(totalPatients / limit) || 1,
      },
    });
  } catch (error) {
    console.error('[patients:list] error:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET /api/patients/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        appointments: {
          orderBy: { appointmentDate: 'desc' },
          include: {
            doctor: { select: { id: true, name: true, specialization: true } },
          },
        },
        queueTokens: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: {
            doctor: { select: { id: true, name: true, specialization: true } },
          },
        },
      },
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ success: true, patient });
  } catch (error) {
    console.error('[patients:get] error:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// POST /api/patients
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, email, phoneNumber, age, gender, medicalHistory } = req.body;

    if (!name || !phoneNumber || !age || !gender) {
      return res.status(400).json({ error: 'Name, phoneNumber, age, and gender are required.' });
    }

    const phoneOk = /^[\d\s+().-]{7,20}$/.test(phoneNumber);
    if (!phoneOk) {
      return res.status(400).json({ error: 'Invalid phone number format.' });
    }

    if (email) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailOk) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }
    }

    const parsedAge = parseInt(age, 10);
    if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 130) {
      return res.status(400).json({ error: 'Invalid age value.' });
    }

    const patient = await prisma.patient.create({
      data: {
        name,
        email: email || null,
        phoneNumber,
        age: parsedAge,
        gender,
        medicalHistory: medicalHistory || null,
      },
    });

    res.status(201).json({ success: true, patient });
  } catch (error) {
    console.error('[patients:create] error:', error);
    res.status(500).json({ error: 'Failed to register patient' });
  }
});

// DELETE /api/patients/:id — admin only
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await prisma.patient.delete({ where: { id } });

    res.json({ message: `Successfully deleted patient ${patient.name}` });
  } catch (error) {
    console.error('[patients:delete] error:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

module.exports = router;
