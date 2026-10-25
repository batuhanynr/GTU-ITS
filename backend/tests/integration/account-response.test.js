import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

function safe(user) {
    assert.equal(Object.hasOwn(user, 'password'), false);
    assert.ok(user.id && user.name && user.username && user.email);
    assert.ok(user.role.name && user.department.id);
    assert.equal(typeof user.requiresPasswordChange, 'boolean');
}

test('member creation returns public fields and the temporary password still works', async t => {
    const c = await context(t), chair = await c.user(); await c.user('Commission Member');
    const email = `new@${c.prefix}.test`;
    const result = await c.request(chair, '/create-commission-member', { departmentId: c.department.id, firstName: c.prefix, lastName: 'new', email, temporaryPassword: 'Testpass123' });
    assert.equal(result.status, 200);
    safe(result.data.user);
    assert.equal(result.data.user.requiresPasswordChange, true);
    const login = await c.request(null, '/login', { email, password: 'Testpass123' });
    assert.equal(login.status, 200);
    assert.ok(login.data.token);
    assert.equal(Object.hasOwn(login.data.user, 'password'), false);
});

test('chair assignment returns public fields without the stored password hash', async t => {
    const target = await context(t), admin = await target.user('General Admin'), source = await context(t), chair = await source.user();
    const result = await target.request(admin, '/assign-commission-chair', { userId: chair.id, departmentId: target.department.id });
    assert.equal(result.status, 200);
    safe(result.data.user);
    assert.equal(result.data.user.department.id, target.department.id);
    assert.equal((await prisma.user.findUnique({ where: { id: chair.id } })).password, chair.password);
});
