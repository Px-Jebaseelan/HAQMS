const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/reports/doctor-stats  (admin only)
router.get('/doctor-stats', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const start = Date.now();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [doctors, apptGroups, completedGroups, cancelledGroups, queueGroups] = await Promise.all([
      prisma.doctor.findMany({
        select: { id: true, name: true, specialization: true, department: true, consultationFee: true },
      }),
      prisma.appointment.groupBy({ by: ['doctorId'], _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ['doctorId'], where: { status: 'COMPLETED' }, _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ['doctorId'], where: { status: 'CANCELLED' }, _count: { _all: true } }),
      prisma.queueToken.groupBy({
        by: ['doctorId'],
        where: { createdAt: { gte: todayStart } },
        _count: { _all: true },
      }),
    ]);

    const lookup = (groups) =>
      Object.fromEntries(groups.map((g) => [g.doctorId, g._count._all]));

    const totals     = lookup(apptGroups);
    const completed  = lookup(completedGroups);
    const cancelled  = lookup(cancelledGroups);
    const todayQueue = lookup(queueGroups);

    const data = doctors.map((d) => ({
      id:                    d.id,
      name:                  d.name,
      specialization:        d.specialization,
      department:            d.department,
      totalAppointments:     totals[d.id]    ?? 0,
      completedAppointments: completed[d.id] ?? 0,
      cancelledAppointments: cancelled[d.id] ?? 0,
      todayQueueSize:        todayQueue[d.id] ?? 0,
      revenue:               (completed[d.id] ?? 0) * d.consultationFee,
    }));

    res.json({ success: true, timeTakenMs: Date.now() - start, data });
  } catch (error) {
    console.error('[reports:doctor-stats] error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
