import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

// Keep the report's readable widths and pagination rules when it is regenerated.
test('report preserves complete rows and a fixed landscape table on regeneration', async t => {
    const c = await context(t);
    const chair = await c.user();
    const term = await c.term();
    const body = c.body(term.id);
    body.studentId = '990000002026';
    c.students[c.students.length - 1] = body.studentId;
    body.studentName = 'Deniz Uzun İsimli Örnek Öğrenci';
    body.companyName = 'Örnek Uluslararası Yazılım Araştırma ve Geliştirme Anonim Şirketi';
    c.companies[c.companies.length - 1] = body.companyName;
    const created = await c.request(chair, '/internship/create', body);
    assert.equal(created.status, 200);
    await prisma.internship.update({ where: { id: created.data.internship.id }, data: { grade: 'S' } });
    const payload = { termId: term.id, departmentId: c.department.id };
    let firstTable;
    for (const includeReported of [false, true]) {
        const report = await c.request(chair, '/internship/generate-report', { ...payload, includeReported });
        assert.equal(report.status, 200);
        const zip = await JSZip.loadAsync(report.bytes);
        const xml = await zip.file('word/document.xml').async('string');
        for (const text of [body.studentId, body.studentName, body.companyName, term.name, c.department.name, new Date(body.startDate).toLocaleDateString('tr-TR'), new Date(body.endDate).toLocaleDateString('tr-TR')]) {
            assert.ok(xml.includes(text), `missing report value: ${text}`);
        }
        assert.match(xml, /<w:pgSz[^>]*w:w="16838"[^>]*w:h="11906"[^>]*w:orient="landscape"/);
        assert.match(xml, /<w:tblLayout w:type="fixed"\/>/);
        const widths = [...xml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map(m => Number(m[1]));
        assert.equal(widths.length, 7);
        assert.equal(widths.reduce((a, b) => a + b, 0), 15398);
        assert.ok(widths[0] >= 1800 && widths[3] >= 4000, 'IDs and company names have enough room');
        const rows = xml.match(/<w:tr>.*?<\/w:tr>/g);
        assert.equal(rows.length, 2);
        assert.match(rows[0], /<w:tblHeader\/>/);
        for (const row of rows) assert.match(row, /<w:cantSplit\/>/);
        assert.match(rows[1], /<w:t[^>]*>S<\/w:t>/);
        const table = xml.match(/<w:tbl>.*?<\/w:tbl>/)[0];
        if (firstTable) assert.equal(table, firstTable, 'regeneration keeps the same table');
        firstTable = table;
    }
});
