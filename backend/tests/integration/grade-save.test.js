import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

// Issue #39: resubmitting the same edits (e.g. a double click while a save is pending) must
// not apply them twice. The optimistic lock makes the repeat a no-op conflict.
test('submitting the same edits twice does not apply them twice', async t => {
    const c = await context(t);
    const chair = await c.user();
    const term = await c.term();
    const body = c.body(term.id);

    const created = await c.request(chair, '/internship/create', body);
    const id = created.data.internship.id; // grade null

    const payload = { grades: [{ internshipId: id, grade: 'S', expectedGrade: null }] };

    // Both requests carry the same baseline (null), as a double submit from one screen would.
    const [a, b] = await Promise.all([
        c.request(chair, '/grade-internships-bulk', payload),
        c.request(chair, '/grade-internships-bulk', payload)
    ]);

    const success = a.data.successCount + b.data.successCount;
    const failed = a.data.errorCount + b.data.errorCount;
    assert.equal(success, 1, 'the edit is applied exactly once');
    assert.equal(failed, 1, 'the duplicate is rejected as a conflict');
    assert.equal((await prisma.internship.findUnique({ where: { id } })).grade, 'S');
});
