import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

async function token(user, code = '123456', attempts = 0) {
    return prisma.passwordResetToken.create({ data: { email: user.email, token: code, attempts, expiresAt: new Date(Date.now() + 60000) } });
}

test('malformed reset input never reads or changes another account token', async t => {
    const c = await context(t), a = await c.user(), b = await c.user();
    await token(a); await token(b, '654321');
    const before = await prisma.passwordResetToken.findMany({ where: { email: { in: [a.email, b.email] } }, orderBy: { id: 'asc' } });
    const inputs = [{ code: '654321' }, { email: '', code: '654321' }, { email: { contains: '.test' }, code: '654321' }, { email: a.email }, { email: a.email, code: 123456 }, { email: a.email, code: '' }, { email: a.email, code: '12345' }, { email: a.email, code: null }];
    for (const path of ['/verify-reset-code', '/reset-password-secure']) {
        for (const body of inputs) {
            const result = await c.request(null, path, { ...body, newPassword: 'Newpass123' });
            assert.equal(result.status, 400, `${path}: ${JSON.stringify(body)}`);
            assert.deepEqual(await prisma.passwordResetToken.findMany({ where: { email: { in: [a.email, b.email] } }, orderBy: { id: 'asc' } }), before);
        }
    }
});

test('wrong codes and lockout affect only the matching token', async t => {
    const c = await context(t), a = await c.user(), b = await c.user();
    const target = await token(a), other = await token(b, '654321');
    for (let i = 0; i < 5; i++) assert.equal((await c.request(null, '/verify-reset-code', { email: a.email, code: '000000' })).status, 400);
    assert.equal((await c.request(null, '/verify-reset-code', { email: a.email, code: '123456' })).status, 429);
    assert.equal(await prisma.passwordResetToken.findUnique({ where: { id: target.id } }), null);
    assert.deepEqual(await prisma.passwordResetToken.findUnique({ where: { id: other.id } }), other);
});

test('valid input still verifies and resets only its account', async t => {
    const c = await context(t), a = await c.user(), b = await c.user();
    await token(a);
    assert.equal((await c.request(null, '/verify-reset-code', { email: a.email, code: '123456' })).status, 200);
    assert.equal((await c.request(null, '/reset-password-secure', { email: a.email, code: '123456', newPassword: 'Newpass123' })).status, 200);
    assert.ok(await bcrypt.compare('Newpass123', (await prisma.user.findUnique({ where: { id: a.id } })).password));
    assert.equal((await prisma.user.findUnique({ where: { id: b.id } })).password, b.password);
});
