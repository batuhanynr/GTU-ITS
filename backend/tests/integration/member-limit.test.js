import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());
const body = (c, suffix, email = `${suffix}@${c.prefix}.test`) => ({ departmentId: c.department.id, firstName: c.prefix, lastName: suffix, email, temporaryPassword: 'Testpass123' });

test('concurrent creates cannot add a third department member', async t => {
    for (let trial = 0; trial < 3; trial++) {
        const c = await context(t), admin = await c.user('General Admin'), existing = await c.user('Commission Member');
        const requests = [body(c, 'one'), body(c, 'two')];
        const responses = await Promise.all(requests.map(data => c.request(admin, '/create-commission-member', data)));
        assert.equal(responses.filter(r => r.status === 200).length, 1);
        const loser = responses.findIndex(r => r.status !== 200);
        assert.ok([400, 409].includes(responses[loser].status));
        assert.equal(await prisma.user.count({ where: { departmentId: c.department.id, roleId: existing.roleId } }), 2);
        assert.equal(await prisma.user.count({ where: { email: requests[loser].email } }), 0);
    }
});

test('duplicate emails and department checks preserve the available slot', async t => {
    const c = await context(t), admin = await c.user('General Admin'), existing = await c.user('Commission Member');
    const other = await context(t), chair = await other.user();
    assert.equal((await c.request(chair, '/create-commission-member', body(c, 'foreign'))).status, 403);
    assert.equal((await c.request(admin, '/create-commission-member', body(c, 'duplicate', existing.email))).status, 400);
    assert.equal(await prisma.user.count({ where: { departmentId: c.department.id, roleId: existing.roleId } }), 1);
    assert.equal((await c.request(admin, '/create-commission-member', body(c, 'valid'))).status, 200);
    assert.equal((await c.request(admin, '/create-commission-member', body(c, 'full'))).status, 400);
});
