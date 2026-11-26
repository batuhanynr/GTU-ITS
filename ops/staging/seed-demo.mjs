import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const database = new URL(process.env.DATABASE_URL);
const password = process.env.DEMO_MEMBER_PASSWORD;
if (database.hostname !== 'db' || database.pathname !== '/gtu_its_staging' || !password || password.length < 16) {
    throw new Error('Use the staging database and a demo password of at least 16 characters.');
}

const prisma = new PrismaClient();
const email = 'winter.member@example.test';
try {
    await prisma.$transaction(async tx => {
        const role = await tx.role.upsert({ where: { name: 'Commission Member' }, update: {}, create: { name: 'Commission Member' } });
        const department = await tx.department.upsert({ where: { name: 'Demo Department' }, update: {}, create: { name: 'Demo Department' } });
        const term = { name: 'Demo Winter Break 2026–2027', startDate: new Date('2027-01-18'), endDate: new Date('2027-02-19') };
        await tx.term.upsert({ where: { name: term.name }, update: {}, create: term });

        // Preserve an existing demo login when the seed is run again.
        await tx.user.upsert({ where: { email }, update: {}, create: {
            email, username: email, name: 'Demo Commission Member', password: await bcrypt.hash(password, 12),
            roleId: role.id, departmentId: department.id
        } });
    });
    console.log('Demo member and winter term are ready.');
} finally {
    await prisma.$disconnect();
}
