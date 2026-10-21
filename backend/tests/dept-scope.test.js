import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import { gradeInternship, bulkGradeInternships } from '../src/controllers/gradingController.js';
import { departmentAccess } from '../src/utils/departmentAccess.js';

test('single and bulk grades reject another department without writing', async () => {
    const original = [prisma.user.findUnique, prisma.internship.findUnique, prisma.internship.update];
    let writes = 0;
    prisma.user.findUnique = async () => ({ departmentId: 1, role: { name: 'Commission Member' } });
    prisma.internship.findUnique = async () => ({ student: { departmentId: 2 } });
    prisma.internship.update = async () => { writes++; };
    const body = { studentId: '123', internshipOrder: 'STAJ1', grade: 'S' };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    try {
        await gradeInternship({ user: { userId: 1 }, body }, res);
        assert.equal(res.statusCode, 403);
        res.statusCode = 200;
        await bulkGradeInternships({ user: { userId: 1 }, body: { grades: [body] } }, res);
        assert.equal(res.body.errorCount, 1);
        assert.equal(res.body.successCount, 0);
        assert.equal(writes, 0);
        assert.equal(await departmentAccess({ user: { userId: 1 } }, res, 1), true);
        assert.equal(await departmentAccess({}, res, 1), false);
        assert.equal(res.statusCode, 401);
    } finally {
        [prisma.user.findUnique, prisma.internship.findUnique, prisma.internship.update] = original;
    }
});
