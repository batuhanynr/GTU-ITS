import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

test('chair removal preserves admin and member accounts', async t => {
    const c = await context(t), admin = await c.user('General Admin'), member = await c.user('Commission Member');
    for (const target of [admin, member]) {
        assert.equal((await c.request(admin, `/remove-commission-chair/${target.id}`, null, 'DELETE')).status, 404);
        assert.deepEqual(await prisma.user.findUnique({ where: { id: target.id } }), target);
    }
});

test('an admin can remove a chair and missing or invalid targets return 404', async t => {
    const c = await context(t), admin = await c.user('General Admin'), chair = await c.user();
    assert.equal((await c.request(admin, `/remove-commission-chair/${chair.id}suffix`, null, 'DELETE')).status, 404);
    assert.ok(await prisma.user.findUnique({ where: { id: chair.id } }));
    assert.equal((await c.request(admin, `/remove-commission-chair/${chair.id}`, null, 'DELETE')).status, 200);
    assert.equal(await prisma.user.findUnique({ where: { id: chair.id } }), null);
    assert.equal((await c.request(admin, `/remove-commission-chair/${chair.id}`, null, 'DELETE')).status, 404);
});

test('members chairs and anonymous callers cannot remove a chair', async t => {
    const c = await context(t), chair = await c.user(), member = await c.user('Commission Member');
    for (const [user, status] of [[null, 401], [chair, 403], [member, 403]]) {
        assert.equal((await c.request(user, `/remove-commission-chair/${chair.id}`, null, 'DELETE')).status, status);
    }
    assert.deepEqual(await prisma.user.findUnique({ where: { id: chair.id } }), chair);
});
