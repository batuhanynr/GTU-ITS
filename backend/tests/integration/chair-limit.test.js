import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

test('concurrent chair assignments preserve one chair and the losing source department', async t => {
    for (let trial = 0; trial < 5; trial++) {
        const target = await context(t), admin = await target.user('General Admin');
        const sources = [await context(t), await context(t)];
        const chairs = [await sources[0].user(), await sources[1].user()];
        const responses = await Promise.all(chairs.map(chair => target.request(admin, '/assign-commission-chair', { userId: chair.id, departmentId: target.department.id })));
        assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
        assert.equal(await prisma.user.count({ where: { departmentId: target.department.id, roleId: chairs[0].roleId } }), 1);
        const loser = responses.findIndex(r => r.status === 409);
        assert.equal((await prisma.user.findUnique({ where: { id: chairs[loser].id } })).departmentId, sources[loser].department.id);
    }
});

test('chair assignment keeps role and occupied-department validation', async t => {
    const c = await context(t), admin = await c.user('General Admin'), chair = await c.user(), member = await c.user('Commission Member');
    const other = await context(t), otherChair = await other.user();
    assert.equal((await c.request(admin, '/assign-commission-chair', { userId: chair.id, departmentId: c.department.id })).status, 200);
    assert.equal((await c.request(admin, '/assign-commission-chair', { userId: member.id, departmentId: c.department.id })).status, 404);
    assert.equal((await c.request(admin, '/assign-commission-chair', { userId: otherChair.id, departmentId: c.department.id })).status, 409);
    assert.equal((await prisma.user.findUnique({ where: { id: otherChair.id } })).departmentId, other.department.id);
});
