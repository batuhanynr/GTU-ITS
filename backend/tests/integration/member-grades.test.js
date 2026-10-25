import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

// Issue #33: grading must target the exact internship by id, so a student with both
// Staj 1 and Staj 2 gets only the intended one graded (member flow).
test('member grading by internshipId changes only the targeted internship', async t => {
    const c = await context(t);
    const member = await c.user('Commission Member');
    const term = await c.term();
    const body = c.body(term.id); // STAJ1 for a new student in this department/term

    let r = await c.request(member, '/internship/create', body);
    assert.equal(r.status, 200);
    const staj1Id = r.data.internship.id;

    // Pass Staj 1 so Staj 2 can be created for the same student and term.
    r = await c.request(member, '/grade-internship', { internshipId: staj1Id, grade: 'S' });
    assert.equal(r.status, 200);

    r = await c.request(member, '/internship/create', { ...body, internshipType: 'STAJ2' });
    assert.equal(r.status, 200);
    const staj2Id = r.data.internship.id;
    assert.notEqual(staj1Id, staj2Id);

    // Grade only Staj 2 by its id; Staj 1 must stay 'S'.
    r = await c.request(member, '/grade-internships-bulk', {
        grades: [{ internshipId: staj2Id, studentId: body.studentId, internshipOrder: 'STAJ2', grade: 'U' }]
    });
    assert.equal(r.data.successCount, 1);
    assert.equal(r.data.errorCount, 0);

    const s1 = await prisma.internship.findUnique({ where: { id: staj1Id } });
    const s2 = await prisma.internship.findUnique({ where: { id: staj2Id } });
    assert.equal(s1.grade, 'S');
    assert.equal(s2.grade, 'U');
});
