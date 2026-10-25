import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

// Issue #38: a stale screen must not overwrite another evaluator's newer grade.
test('a stale grade save is rejected and does not overwrite a newer grade', async t => {
    const c = await context(t);
    const a = await c.user('Commission Chair');
    const b = await c.user('Commission Member');
    const term = await c.term();
    const body = c.body(term.id);

    const created = await c.request(a, '/internship/create', body);
    const id = created.data.internship.id; // grade is null

    // Evaluator A grades U based on the null it last saw.
    let r = await c.request(a, '/grade-internships-bulk', { grades: [{ internshipId: id, grade: 'U', expectedGrade: null }] });
    assert.equal(r.data.successCount, 1);
    assert.equal((await prisma.internship.findUnique({ where: { id } })).grade, 'U');

    // Evaluator B still has the old null; saving S must conflict, not overwrite the U.
    r = await c.request(b, '/grade-internships-bulk', { grades: [{ internshipId: id, grade: 'S', expectedGrade: null }] });
    assert.equal(r.data.successCount, 0);
    assert.equal(r.data.errorCount, 1);
    assert.match(r.data.errors[0].error, /Conflict/);
    assert.equal((await prisma.internship.findUnique({ where: { id } })).grade, 'U', 'newer grade preserved');

    // After seeing the current value, B can retry against it.
    r = await c.request(b, '/grade-internships-bulk', { grades: [{ internshipId: id, grade: 'S', expectedGrade: 'U' }] });
    assert.equal(r.data.successCount, 1);
    assert.equal((await prisma.internship.findUnique({ where: { id } })).grade, 'S');

    // The single-grade endpoint enforces the same lock (409 on a stale expectedGrade).
    const single = await c.request(a, '/grade-internship', { internshipId: id, grade: 'U', expectedGrade: 'U' });
    assert.equal(single.status, 409); // current is 'S', not the expected 'U'
});
