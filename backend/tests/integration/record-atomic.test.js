import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

test('a duplicate failed internship does not alter the student or leave a company', async t => {
    const c = await context(t), user = await c.user(), term = await c.term(), body = c.body(term.id);
    const first = await c.request(user, '/internship/create', body);
    assert.equal(first.status, 200);
    await prisma.internship.update({ where: { id: first.data.internship.id }, data: { grade: 'U' } });
    const before = await prisma.student.findUnique({ where: { id: body.studentId } });
    const companyName = `${c.prefix}duplicate`; c.companies.push(companyName);
    const result = await c.request(user, '/internship/create', { ...body, studentName: 'Rejected name', studentPhone: '999', companyName });
    assert.equal(result.status, 400);
    assert.deepEqual(await prisma.student.findUnique({ where: { id: body.studentId } }), before);
    assert.equal(await prisma.company.count({ where: { name: companyName } }), 0);
});

test('a missing term leaves no student company or internship', async t => {
    const c = await context(t), user = await c.user(), body = c.body(2147483647);
    const result = await c.request(user, '/internship/create', body);
    assert.ok(result.status >= 400);
    assert.equal(await prisma.student.count({ where: { id: body.studentId } }), 0);
    assert.equal(await prisma.company.count({ where: { name: body.companyName } }), 0);
    assert.equal(await prisma.internship.count({ where: { studentId: body.studentId } }), 0);
});

test('a valid upload commits its original PDF and preserves existing contact data', async t => {
    const c = await context(t), user = await c.user(), term = await c.term(), body = c.body(term.id);
    await prisma.student.create({ data: { id: body.studentId, name: body.studentName, email: body.studentEmail, phone_number: '555', departmentId: c.department.id } });
    const bytes = Buffer.from('%PDF-1.4\nsource-document'), form = new FormData();
    form.append('data', JSON.stringify({ ...body, studentEmail: '', studentPhone: '' }));
    form.append('file', new Blob([bytes], { type: 'application/pdf' }), 'source.pdf');
    const result = await c.request(user, '/internship/create', form);
    assert.equal(result.status, 200);
    const document = await c.request(user, `/internship/${result.data.internship.id}/document`, null, 'GET');
    assert.deepEqual(document.bytes, bytes);
    assert.equal(result.data.internship.student.phone_number, '555');
    assert.equal(result.data.internship.student.email, body.studentEmail);
});
