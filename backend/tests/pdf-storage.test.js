import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import { createInternship, getOriginalDocument } from '../src/controllers/internshipController.js';

test('approved PDF bytes are saved and downloads enforce department access', async () => {
    const originals = [prisma.user.findUnique, prisma.student.findUnique, prisma.student.upsert, prisma.company.upsert,
        prisma.internship.findUnique, prisma.internship.create, prisma.internshipDocument.findUnique];
    const bytes = Buffer.from('%PDF-1.4\noriginal-file');
    let stored, department = 1;
    prisma.user.findUnique = async () => ({ departmentId: department, role: { name: 'Commission Member' } });
    prisma.student.findUnique = async () => null;
    prisma.student.upsert = async () => ({});
    prisma.company.upsert = async () => ({ id: 1 });
    prisma.internship.findUnique = async () => null;
    prisma.internship.create = async ({ data }) => { stored = data.originalDocument.create; return { id: 42 }; };
    prisma.internshipDocument.findUnique = async () => stored;
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; }, setHeader() {}, send(body) { this.bytes = body; } };
    try {
        await createInternship({ user: { userId: 1 }, file: { originalname: 'source.pdf', buffer: bytes }, body: {
            studentId: '123', studentName: 'Test Student', companyName: 'Test Company', startDate: '2026-07-01',
            endDate: '2026-08-01', internshipType: 'STAJ1', termId: 1, departmentId: 1
        } }, res);
        assert.deepEqual(stored, { name: 'source.pdf', data: bytes });
        prisma.internship.findUnique = async () => ({ id: 42, student: { departmentId: 1 } });
        await getOriginalDocument({ user: { userId: 1 }, params: { id: '42' } }, res);
        assert.deepEqual(res.bytes, bytes);
        department = 2;
        res.bytes = null;
        await getOriginalDocument({ user: { userId: 1 }, params: { id: '42' } }, res);
        assert.equal(res.statusCode, 403);
        assert.equal(res.bytes, null);
        department = 1;
        prisma.internshipDocument.findUnique = async () => null;
        await getOriginalDocument({ user: { userId: 1 }, params: { id: '42' } }, res);
        assert.equal(res.statusCode, 404);
    } finally {
        [prisma.user.findUnique, prisma.student.findUnique, prisma.student.upsert, prisma.company.upsert,
            prisma.internship.findUnique, prisma.internship.create, prisma.internshipDocument.findUnique] = originals;
    }
});
