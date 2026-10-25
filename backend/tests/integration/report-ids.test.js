import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

async function docText(bytes) {
    const zip = await JSZip.loadAsync(bytes);
    return zip.file('word/document.xml').async('string');
}

// Issue #35: an early report must include exactly the selected internships, not every
// internship of the same student, and must never include another department's records.
test('report with internshipIds includes only those internships', { timeout: 20000 }, async t => {
    const c = await context(t);
    const chair = await c.user();
    const term = await c.term();
    const body = c.body(term.id);

    // Staj 1 and Staj 2 for the same student, with different companies.
    let r = await c.request(chair, '/internship/create', body);
    const staj1Id = r.data.internship.id;
    await c.request(chair, '/grade-internship', { internshipId: staj1Id, grade: 'S' });
    const companyB = `${body.companyName}B`; c.companies.push(companyB);
    r = await c.request(chair, '/internship/create', { ...body, internshipType: 'STAJ2', companyName: companyB });
    const staj2Id = r.data.internship.id;

    // Another department's internship (own context/term), to test the department guard.
    const o = await context(t);
    const oUser = await o.user();
    const oTerm = await o.term();
    const oBody = o.body(oTerm.id);
    r = await o.request(oUser, '/internship/create', oBody);
    const otherId = r.data.internship.id;

    // Report only Staj 1, also trying to sneak in the other department's id.
    const report = await c.request(chair, '/internship/generate-report', {
        termId: term.id, departmentId: c.department.id, internshipIds: [staj1Id, otherId]
    });
    assert.equal(report.status, 200);
    const xml = await docText(report.bytes);

    assert.ok(xml.includes(body.companyName), 'selected Staj 1 company is present');
    assert.ok(!xml.includes(companyB), 'unselected Staj 2 company is excluded');
    assert.ok(!xml.includes(oBody.companyName), 'other department internship is excluded');

    // Only the selected Staj 1 is marked reported.
    assert.equal((await prisma.internship.findUnique({ where: { id: staj1Id } })).isReported, true);
    assert.equal((await prisma.internship.findUnique({ where: { id: staj2Id } })).isReported, false);
    assert.equal((await prisma.internship.findUnique({ where: { id: otherId } })).isReported, false);
});
