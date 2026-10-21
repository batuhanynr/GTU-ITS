import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import { updateInternship, deleteInternship } from '../src/controllers/internshipController.js';

test('corrections use the selected ID and cannot change grades or ownership', async () => {
    const original = [prisma.user.findUnique, prisma.internship.findUnique, prisma.internship.update, prisma.internship.delete, prisma.company.upsert];
    let saved, deleted, writes = 0;
    prisma.user.findUnique = async () => ({ departmentId: 1, role: { name: 'Commission Chair' } });
    prisma.internship.findUnique = async () => ({ student: { departmentId: 1 }, startDate: new Date('2026-07-01'), endDate: new Date('2026-08-01') });
    prisma.company.upsert = async () => ({ id: 3 });
    prisma.internship.update = async args => { saved = args; writes++; return args.data; };
    prisma.internship.delete = async args => { deleted = args; };
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    const req = { user: { userId: 1 }, params: { id: '42' }, body: { companyName: 'Correct Company', durationDays: 20, grade: 'S', student: { connect: { id: 'other' } }, termId: 99 } };
    try {
        await updateInternship(req, res);
        assert.deepEqual(saved.where, { id: 42 });
        assert.deepEqual(saved.data, { companyId: 3, durationDays: 20 });
        await deleteInternship(req, res);
        assert.deepEqual(deleted.where, { id: 42 });
        req.body = { endDate: '2026-06-01' };
        await updateInternship(req, res);
        assert.equal(res.statusCode, 400);
        assert.equal(writes, 1);
    } finally { [prisma.user.findUnique, prisma.internship.findUnique, prisma.internship.update, prisma.internship.delete, prisma.company.upsert] = original; }
});
