import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

// Issue #37: two parallel creates for different terms must not both create an active Staj 1.
test('concurrent creates leave at most one active internship of a type', async t => {
    const c = await context(t);
    const user = await c.user();
    const termA = await c.term();
    const termB = await c.term();
    const body = c.body(termA.id); // STAJ1

    // Pre-create student and company so the only contended unique is the internship index.
    await prisma.student.create({ data: { id: body.studentId, name: body.studentName, email: body.studentEmail, phone_number: '555', departmentId: c.department.id } });
    await prisma.company.create({ data: { name: body.companyName } });
    c.companies.push(body.companyName);

    // Fire both requests at once (different terms).
    const [a, b] = await Promise.all([
        c.request(user, '/internship/create', body),
        c.request(user, '/internship/create', { ...body, termId: termB.id })
    ]);

    const statuses = [a.status, b.status].sort();
    // Exactly one succeeds; the other is rejected with a client conflict (no 500).
    assert.equal(statuses[0], 200, `one must succeed, got ${JSON.stringify(statuses)}`);
    assert.ok(statuses[1] >= 400 && statuses[1] < 500, `loser must be a 4xx conflict, got ${statuses[1]}`);

    // The database holds exactly one active (ungraded) Staj 1 for this student.
    const active = await prisma.internship.count({
        where: { studentId: body.studentId, internshipOrder: 'STAJ1', grade: null }
    });
    assert.equal(active, 1);
});

// A failed internship can still be retaken in a different term; an active/passed one blocks it.
test('retake after fail works but active or passed still blocks', async t => {
    const c = await context(t);
    const user = await c.user();
    const termA = await c.term();
    const termB = await c.term();
    const body = c.body(termA.id);

    let r = await c.request(user, '/internship/create', body);
    assert.equal(r.status, 200);
    const firstId = r.data.internship.id;

    // While it is still active, a second attempt is blocked.
    r = await c.request(user, '/internship/create', { ...body, termId: termB.id });
    assert.ok(r.status >= 400);

    // Fail the first, then the retake in another term succeeds.
    await prisma.internship.update({ where: { id: firstId }, data: { grade: 'U' } });
    r = await c.request(user, '/internship/create', { ...body, termId: termB.id });
    assert.equal(r.status, 200);
});
