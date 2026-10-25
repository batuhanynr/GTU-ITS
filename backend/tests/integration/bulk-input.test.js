import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

// Issue #40: a malformed row (null) after a valid one must not cause a 500 with an
// unreported partial write. Each row gets an accurate success/error result.
test('bulk grading reports a malformed row and still records the valid one', async t => {
    const c = await context(t);
    const chair = await c.user();
    const term = await c.term();
    const body = c.body(term.id);

    let r = await c.request(chair, '/internship/create', body);
    assert.equal(r.status, 200);
    const staj1Id = r.data.internship.id;

    r = await c.request(chair, '/grade-internships-bulk', {
        grades: [{ internshipId: staj1Id, grade: 'S' }, null]
    });
    assert.equal(r.status, 200);                 // not a 500
    assert.equal(r.data.successCount, 1);        // valid row succeeded
    assert.equal(r.data.errorCount, 1);          // malformed row reported

    // Stored grade reflects only the valid row.
    const s1 = await prisma.internship.findUnique({ where: { id: staj1Id } });
    assert.equal(s1.grade, 'S');
});
