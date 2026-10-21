import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import { createInternship } from '../src/controllers/internshipController.js';
test('invalid form fields are rejected before any database access', async () => {
    const original = prisma.user.findUnique;
    let reads = 0;
    prisma.user.findUnique = async () => { reads++; throw new Error('Should not query'); };
    const valid = { studentId: '123', studentName: 'Student', companyName: 'Company', startDate: '2026-07-01', endDate: '2026-08-01', internshipType: 'STAJ1', termId: 1, departmentId: 1, duration: 20 };
    const cases = [{ studentName: 'NOT FOUND' }, { studentId: 'NOT FOUND' }, { companyName: ' not found ' }, { studentName: '' },
        { endDate: '2026-06-01' }, { startDate: '2026-02-30' }, { endDate: 'invalid' }, { startDate: '31.04.2026' },
        { duration: 0 }, { duration: -1 }, { duration: '20days' }, { termId: '1bad' }, { departmentId: null }, { studentEmail: 'NOT FOUND' }];
    try {
        for (const fields of cases) {
            const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
            await createInternship({ user: { userId: 1 }, body: { ...valid, ...fields } }, res);
            assert.equal(res.statusCode, 400, JSON.stringify(fields));
        }
        assert.equal(reads, 0);
    } finally { prisma.user.findUnique = original; }
});
