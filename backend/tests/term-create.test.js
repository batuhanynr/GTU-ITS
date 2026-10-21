import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import { createTerm } from '../src/controllers/studentController.js';
import { calendarDate } from '../src/utils/calendarDate.js';
test('terms are persisted and invalid or duplicate terms are rejected', async () => {
    const original = prisma.term.create;
    const records = [];
    prisma.term.create = async ({ data }) => {
        if (records.some(term => term.name === data.name)) throw { code: 'P2002' };
        const term = { id: 5, ...data }; records.push(term); return term;
    };
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    try {
        const body = { name: 'Summer 2027', startDate: '2027-06-01', endDate: '2027-09-01' };
        await createTerm({ body }, res);
        assert.equal(res.statusCode, 201); assert.equal(res.body.id, 5); assert.equal(records.length, 1);
        await createTerm({ body }, res); assert.equal(res.statusCode, 409);
        await createTerm({ body: { ...body, endDate: '2027-05-01' } }, res); assert.equal(res.statusCode, 400);
        assert.equal(calendarDate('2027-02-30'), null);
        assert.equal(calendarDate('31.04.2027'), null);
        assert.equal(calendarDate('29.02.2028').toISOString(), '2028-02-29T00:00:00.000Z');
        assert.equal(records.length, 1);
    } finally { prisma.term.create = original; }
});
