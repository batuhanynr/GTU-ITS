import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

// Issue #34: a partial failure must separate saved rows from failed ones by internshipId,
// which is what the UI uses to clear saved edits and keep failed ones pending for retry.
test('partial bulk failure reports saved and failed rows by internship id', async t => {
    const c = await context(t);
    const chair = await c.user();
    const term = await c.term();
    const body = c.body(term.id);

    let r = await c.request(chair, '/internship/create', body);
    const staj1Id = r.data.internship.id;

    r = await c.request(chair, '/grade-internships-bulk', {
        grades: [
            { internshipId: staj1Id, grade: 'S' },      // valid -> saved
            { internshipId: 999999999, grade: 'S' }      // missing -> failed
        ]
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.successCount, 1);
    assert.equal(r.data.errorCount, 1);
    assert.ok(r.data.results.some(x => x.internshipId === staj1Id), 'saved row is identified');
    assert.ok(r.data.errors.some(x => x.internshipId === 999999999), 'failed row is identified');

    assert.equal((await prisma.internship.findUnique({ where: { id: staj1Id } })).grade, 'S');
});
