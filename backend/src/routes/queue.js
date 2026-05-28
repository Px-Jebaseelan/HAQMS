const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/queue
router.get('/', async (req, res) => {
  try {
    const { doctorId, status } = req.query;

    const where = {};
    if (doctorId) where.doctorId = doctorId;
    if (status)   where.status   = status;

    const tokens = await prisma.queueToken.findMany({
      where,
      include: { patient: true, doctor: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json(tokens);
  } catch (error) {
    console.error('[queue:list] error:', error);
    res.status(500).json({ error: 'Failed to retrieve queue' });
  }
});

// POST /api/queue/checkin
router.post('/checkin', authenticate, async (req, res) => {
  try {
    const { patientId, doctorId, appointmentId } = req.body;

    if (!patientId || !doctorId) {
      return res.status(400).json({ error: 'Patient and Doctor ID are required for check-in.' });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Use a transaction with a Postgres advisory lock to prevent concurrent duplicate tokens.
    // pg_advisory_xact_lock is held for the duration of the transaction, serializing
    // all concurrent check-ins for the same (doctor, day) pair.
    const lockKey = `${doctorId}:${todayStart.toISOString().slice(0, 10)}`;

    const newToken = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const maxResult = await tx.queueToken.aggregate({
        where: { doctorId, createdAt: { gte: todayStart } },
        _max: { tokenNumber: true },
      });

      const nextTokenNumber = (maxResult._max.tokenNumber ?? 0) + 1;

      return tx.queueToken.create({
        data: {
          tokenNumber: nextTokenNumber,
          patientId,
          doctorId,
          appointmentId: appointmentId || null,
          status: 'WAITING',
        },
        include: { patient: true, doctor: true },
      });
    });

    res.status(201).json({ message: 'Checked in successfully. Token generated.', token: newToken });
  } catch (error) {
    console.error('[queue:checkin] error:', error);
    res.status(500).json({ error: 'Check-in failed' });
  }
});

// PATCH /api/queue/:id
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updatedToken = await prisma.queueToken.update({
      where: { id: req.params.id },
      data: { status },
      include: { patient: true, doctor: true },
    });

    res.json(updatedToken);
  } catch (error) {
    console.error('[queue:patch] error:', error);
    res.status(500).json({ error: 'Failed to update queue token' });
  }
});

module.exports = router;
