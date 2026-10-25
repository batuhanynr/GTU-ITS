import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Require an explicit local test database before importing the application client.
const url = new URL(process.env.TEST_DATABASE_URL || 'postgresql://invalid/');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && /^\/gtu_[a-z0-9_]*test$/.test(url.pathname), 'Set TEST_DATABASE_URL to a local gtu_*test database.');
process.env.DATABASE_URL = url.href;
process.env.JWT_SECRET = 'integration-tests-only';
export const { default: prisma } = await import('../../src/config/prisma.js');
const { default: app } = await import('../../src/server.js');

export async function context(t) {
    const prefix = randomUUID().replaceAll('-', '');
    const department = await prisma.department.create({ data: { name: prefix } });
    const users = [], students = [], terms = [], companies = [];
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.on('listening', resolve));
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        await prisma.passwordResetToken.deleteMany({ where: { email: { endsWith: `@${prefix}.test` } } });
        await prisma.internship.deleteMany({ where: { studentId: { in: students } } });
        await prisma.student.deleteMany({ where: { id: { in: students } } });
        await prisma.user.deleteMany({ where: { OR: [{ id: { in: users } }, { departmentId: department.id }] } });
        await prisma.company.deleteMany({ where: { name: { in: companies } } });
        await prisma.term.deleteMany({ where: { id: { in: terms } } });
        await prisma.department.delete({ where: { id: department.id } });
    });
    return {
        prefix, department, students, companies,
        async user(role = 'Commission Chair', data = {}) {
            const r = await prisma.role.upsert({ where: { name: role }, create: { name: role }, update: {} });
            const n = users.length;
            const user = await prisma.user.create({ data: { name: `Test ${n}`, username: `${prefix}${n}`, email: `${n}@${prefix}.test`, password: await bcrypt.hash('Testpass123', 4), roleId: r.id, departmentId: department.id, ...data } });
            users.push(user.id);
            return user;
        },
        async term() {
            const term = await prisma.term.create({ data: { name: `${prefix}${terms.length}`, startDate: new Date('2028-01-01'), endDate: new Date('2028-12-31') } });
            terms.push(term.id);
            return term;
        },
        body(termId) {
            const studentId = String(BigInt(`0x${prefix.slice(0, 12)}`) + BigInt(students.length));
            students.push(studentId);
            const companyName = `${prefix}${companies.length}`;
            companies.push(companyName);
            return { studentId, studentName: 'Original student', studentEmail: `${studentId}@${prefix}.test`, studentPhone: '555', companyName, departmentId: department.id, termId, internshipType: 'STAJ1', duration: 20, startDate: '2028-06-01', endDate: '2028-07-01' };
        },
        async request(user, path, body, method = 'POST') {
            const headers = {};
            if (user) headers.Authorization = `Bearer ${jwt.sign({ userId: user.id }, process.env.JWT_SECRET)}`;
            if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
            const bytes = Buffer.from(await response.arrayBuffer());
            let data; try { data = JSON.parse(bytes.toString()); } catch {}
            return { status: response.status, data, bytes };
        }
    };
}
