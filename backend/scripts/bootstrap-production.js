import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';

const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!email || !password || password.length < 16) {
    throw new Error('Set a bootstrap email and a password of at least 16 characters.');
}
try {
    await prisma.$transaction(async tx => {
        const role = await tx.role.upsert({ where: { name: 'General Admin' }, update: {}, create: { name: 'General Admin' } });
        for (const name of ['Commission Chair', 'Commission Member']) {
            await tx.role.upsert({ where: { name }, update: {}, create: { name } });
        }
        await tx.department.upsert({ where: { name: 'Bilgisayar Mühendisliği (İngilizce)' }, update: {}, create: { name: 'Bilgisayar Mühendisliği (İngilizce)' } });
        const existing = await tx.user.findUnique({ where: { email }, include: { role: true } });
        // A repeat installation must never reset an existing account or password.
        if (existing) {
            if (existing.role.name !== 'General Admin') throw new Error('The bootstrap email belongs to a different role.');
            console.log('Existing administrator left unchanged.');
            return;
        }
        await tx.user.create({ data: {
            name: process.env.BOOTSTRAP_ADMIN_NAME || 'System Administrator',
            username: email, email, password: await bcrypt.hash(password, 12),
            roleId: role.id, requiresPasswordChange: true
        } });
        console.log('Initial administrator created; password change is required.');
    });
} finally {
    await prisma.$disconnect();
}
