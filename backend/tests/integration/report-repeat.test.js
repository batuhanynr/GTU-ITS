import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

async function docText(bytes) {
    const zip = await JSZip.loadAsync(bytes);
    return zip.file('word/document.xml').async('string');
}

// Issue #36: a member can regenerate a report for already-reported internships.
test('member can regenerate a report; normal report still excludes reported records', async t => {
    const c = await context(t);
    const member = await c.user('Commission Member');
    const term = await c.term();
    const body = c.body(term.id);

    let r = await c.request(member, '/internship/create', body);
    const staj1Id = r.data.internship.id;
    await c.request(member, '/grade-internship', { internshipId: staj1Id, grade: 'S' });

    // First report succeeds and marks the record reported.
    const first = await c.request(member, '/internship/generate-report', { termId: term.id, departmentId: c.department.id });
    assert.equal(first.status, 200);
    assert.equal((await prisma.internship.findUnique({ where: { id: staj1Id } })).isReported, true);

    // Normal report now has nothing new to report.
    const normal = await c.request(member, '/internship/generate-report', { termId: term.id, departmentId: c.department.id });
    assert.equal(normal.status, 404);

    // Regenerate includes the reported record again, with its current grade.
    const again = await c.request(member, '/internship/generate-report', { termId: term.id, departmentId: c.department.id, includeReported: true });
    assert.equal(again.status, 200);
    const xml = await docText(again.bytes);
    assert.ok(xml.includes(body.studentId), 'regenerated report includes the requested student');

    // Cross-department report access stays blocked.
    const o = await context(t);
    const cross = await c.request(member, '/internship/generate-report', { termId: term.id, departmentId: o.department.id });
    assert.equal(cross.status, 403);
});
