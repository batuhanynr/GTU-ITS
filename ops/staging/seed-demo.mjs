import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const computer = 'Bilgisayar Mühendisliği (İngilizce)';
const electronics = 'Elektronik Mühendisliği';
const mechanical = 'Makine Mühendisliği (İngilizce)';
const accounts = [
    { username: 'admin1', name: 'Admin User', role: 'General Admin' },
    { username: 'admin2', name: 'Admin Two', role: 'General Admin' },
    { username: 'ceng_chair', name: 'Ahmet Yılmaz', role: 'Commission Chair', department: computer },
    { username: 'ceng_member1', name: 'Mehmet Kaya', role: 'Commission Member', department: computer },
    { username: 'ceng_member2', name: 'Ayşe Demir', role: 'Commission Member', department: computer },
    { username: 'eeng_chair', name: 'Fatma Öztürk', role: 'Commission Chair', department: electronics },
    { username: 'eeng_member1', name: 'Can Arslan', role: 'Commission Member', department: electronics },
    { username: 'eeng_member2', name: 'Zeynep Çelik', role: 'Commission Member', department: electronics },
    { username: 'meng_chair', name: 'Burak Şahin', role: 'Commission Chair', department: mechanical },
    { username: 'meng_member1', name: 'Elif Yıldız', role: 'Commission Member', department: mechanical },
    { username: 'meng_member2', name: 'Emre Aydın', role: 'Commission Member', department: mechanical }
].map(account => ({ ...account, email: `${account.username}@gtu.edu.tr` }));

const database = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
if (database.hostname !== 'db' || database.pathname !== '/gtu_its_staging') {
    throw new Error('Use the staging database.');
}

if (process.argv[2] === '--generate-passwords') {
    const passwords = Object.fromEntries(accounts.map(({ email }) => [email, `staging-${randomBytes(16).toString('hex')}`]));
    console.log(JSON.stringify(passwords, null, 2));
    process.exit(0);
}

const passwords = JSON.parse(process.env.STAGING_DEMO_PASSWORDS ?? '{}');
const accountPasswords = accounts.map(({ email }) => passwords[email]);
if (accountPasswords.some(password => !/^staging-[a-f0-9]{32}$/.test(password)) || new Set(accountPasswords).size !== accounts.length) {
    throw new Error('Generate a separate staging password for each demo account.');
}
const hashes = await Promise.all(accountPasswords.map(password => bcrypt.hash(password, 12)));

const prisma = new PrismaClient();
const legacyEmail = 'winter.member@example.test';
const architecture = 'Mimarlık';
const term = { name: '2026–2027 Dönem Arası (Staging)', startDate: new Date('2027-01-18'), endDate: new Date('2027-02-19') };
try {
    await prisma.$transaction(async tx => {
        // Preserve the existing demo rows when switching to the local demo labels.
        if (!await tx.department.findUnique({ where: { name: architecture } })) {
            await tx.department.updateMany({ where: { name: 'Demo Department' }, data: { name: architecture } });
        }
        if (!await tx.term.findUnique({ where: { name: term.name } })) {
            await tx.term.updateMany({ where: { name: 'Demo Winter Break 2026–2027' }, data: { name: term.name } });
        }
        if (!await tx.user.findUnique({ where: { username: 'ceng_member1' } })) {
            await tx.user.updateMany({ where: { username: legacyEmail, email: legacyEmail }, data: { username: 'ceng_member1' } });
        }

        const roles = new Map();
        for (const name of new Set(accounts.map(({ role }) => role))) {
            roles.set(name, await tx.role.upsert({ where: { name }, update: {}, create: { name } }));
        }
        const departments = new Map();
        for (const name of [computer, electronics, mechanical, architecture]) {
            departments.set(name, await tx.department.upsert({ where: { name }, update: {}, create: { name } }));
        }
        await tx.term.upsert({ where: { name: term.name }, update: {}, create: term });

        for (const [index, { username, email, name, role, department }] of accounts.entries()) {
            const data = { email, name, password: hashes[index], roleId: roles.get(role).id,
                departmentId: departments.get(department)?.id ?? null, requiresPasswordChange: false };
            await tx.user.upsert({ where: { username }, update: data, create: { username, ...data } });
        }
    });
    console.log(`${accounts.length} staging accounts and the winter term are ready.`);
} finally {
    await prisma.$disconnect();
}
