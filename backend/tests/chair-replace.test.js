import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import { createCommissionChair } from '../src/controllers/departmentController.js';

test('chair replacement uses one transaction and preserves the old chair on failure', async () => {
    const original = [prisma.role.findUnique, prisma.$transaction];
    const oldChair = { id: 1, email: 'old@example.com' };
    let records = [oldChair];
    let shouldFail = true;
    let transactions = 0;
    prisma.role.findUnique = async () => ({ id: 2 });
    prisma.$transaction = async (work, options) => {
        transactions++;
        assert.equal(options.isolationLevel, 'Serializable');
        const pending = [...records];
        const result = await work({ user: {
            findFirst: async () => pending[0],
            delete: async () => pending.splice(0, 1),
            create: async ({ data }) => {
                if (shouldFail) throw Object.assign(new Error('Email already used'), { code: 'P2002' });
                const created = { id: 2, name: data.name, email: data.email };
                pending.push(created);
                return created;
            }
        } });
        records = pending;
        return result;
    };
    const req = { body: { departmentId: 1, firstName: 'New', lastName: 'Chair', email: 'new@example.com', temporaryPassword: 'test-password' } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    try {
        await createCommissionChair(req, res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(records, [oldChair]);
        shouldFail = false;
        await createCommissionChair(req, res);
        assert.equal(records.length, 1);
        assert.equal(records[0].email, 'new@example.com');
        assert.equal(transactions, 2);
        assert.equal(res.body.user.password, undefined);
    } finally { [prisma.role.findUnique, prisma.$transaction] = original; }
});
