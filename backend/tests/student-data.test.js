import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import { createInternship } from '../src/controllers/internshipController.js';

test('missing contact fields preserve existing data and uploads cannot move students', async () => {
    const originals = [prisma.user.findUnique, prisma.student.findUnique, prisma.student.upsert, prisma.company.upsert, prisma.internship.findUnique, prisma.internship.create];
    let student = { id: '123', name: 'Student', email: 'real@example.org', phone_number: '555', departmentId: 1 };
    let updates = 0;
    prisma.user.findUnique = async () => ({ role: { name: 'General Admin' } });
    prisma.student.findUnique = async () => student;
    prisma.student.upsert = async ({ update }) => { assert.equal(update.departmentId, undefined); updates++; student = { ...student, ...update }; };
    prisma.company.upsert = async () => ({ id: 1 });
    prisma.internship.findUnique = async () => null;
    prisma.internship.create = async () => ({ id: 42 });
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    const body = { studentId: '123', studentName: 'Student', studentEmail: '', studentPhone: '', companyName: 'Company',
        startDate: '2026-07-01', endDate: '2026-08-01', internshipType: 'STAJ1', termId: 1, departmentId: 1 };
    try {
        await createInternship({ user: { userId: 1 }, body }, res);
        assert.equal(student.email, 'real@example.org'); assert.equal(student.phone_number, '555');
        await createInternship({ user: { userId: 1 }, body: { ...body, studentEmail: 'updated@example.org', studentPhone: '777' } }, res);
        assert.equal(student.email, 'updated@example.org'); assert.equal(student.phone_number, '777');
        await createInternship({ user: { userId: 1 }, body: { ...body, departmentId: 2 } }, res);
        assert.equal(res.statusCode, 409); assert.equal(student.departmentId, 1); assert.equal(updates, 2);
    } finally { [prisma.user.findUnique, prisma.student.findUnique, prisma.student.upsert, prisma.company.upsert, prisma.internship.findUnique, prisma.internship.create] = originals; }
});
