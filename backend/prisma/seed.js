const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // --- Admin user ---
  await prisma.user.upsert({
    where: { email: 'admin@haqms.com' },
    update: {},
    create: { email: 'admin@haqms.com', password: passwordHash, name: 'Alice Admin', role: 'ADMIN' },
  });

  // --- Receptionist ---
  await prisma.user.upsert({
    where: { email: 'reception1@haqms.com' },
    update: {},
    create: { email: 'reception1@haqms.com', password: passwordHash, name: 'Riley Reception', role: 'RECEPTIONIST' },
  });

  // --- Doctor users + linked Doctor records ---
  const doctorSeeds = [
    { email: 'doctor1@haqms.com', name: 'Dr. Gregory House',   spec: 'Diagnostics',    dept: 'Internal Medicine', fee: 250, exp: 18 },
    { email: 'doctor2@haqms.com', name: 'Dr. Meredith Grey',   spec: 'General Surgery', dept: 'Surgery',           fee: 320, exp: 12 },
    { email: 'doctor3@haqms.com', name: 'Dr. Derek Shepherd',  spec: 'Neurology',       dept: 'Surgery',           fee: 400, exp: 22 },
    { email: 'doctor4@haqms.com', name: 'Dr. Cristina Yang',   spec: 'Cardiothoracics', dept: 'Surgery',           fee: 380, exp: 15 },
  ];

  const createdDoctors = [];
  for (const d of doctorSeeds) {
    const u = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
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
          },
        },
      },
      include: { doctor: true },
    });
    createdDoctors.push(u.doctor);
  }

  // --- Patients (some with null medicalHistory to exercise the null-crash fix) ---
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
    const existing = await prisma.patient.findFirst({ where: { phoneNumber: p.phoneNumber } });
    if (existing) {
      patients.push(existing);
    } else {
      patients.push(await prisma.patient.create({ data: p }));
    }
  }

  // --- Seed a handful of appointments ---
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
    const existing = await prisma.appointment.findFirst({
      where: { doctorId: doc.id, appointmentDate: apptDate },
    });
    if (!existing) {
      await prisma.appointment.create({
        data: {
          patientId: pat.id,
          doctorId: doc.id,
          appointmentDate: apptDate,
          reason: a.reason,
          status: a.status || 'PENDING',
        },
      });
    }
  }

  console.log(`Seeded: ${createdDoctors.length} doctors, ${patients.length} patients, ${appointmentSeeds.length} appointments.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
