import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { context, prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

async function code(email, expiresAt = new Date(Date.now() + 60000)) {
    return prisma.passwordResetToken.create({ data: { email, token: '123456', expiresAt } });
}

test('only one concurrent request can consume a reset code', async t => {
    const c = await context(t);
    for (let trial = 0; trial < 3; trial++) {
        const user = await c.user(); await code(user.email);
        const passwords = ['Firstpass123', 'Secondpass123'];
        const responses = await Promise.all(passwords.map(newPassword => c.request(null, '/reset-password-secure', { email: user.email, code: '123456', newPassword })));
        assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
        const stored = await prisma.user.findUnique({ where: { id: user.id } });
        const winner = responses.findIndex(r => r.status === 200);
        assert.ok(await bcrypt.compare(passwords[winner], stored.password));
        assert.equal(await bcrypt.compare(passwords[1 - winner], stored.password), false);
        assert.equal(await prisma.passwordResetToken.count({ where: { email: user.email } }), 0);
    }
});

test('used and expired codes do not change the password', async t => {
    const c = await context(t), user = await c.user(); await code(user.email);
    const body = { email: user.email, code: '123456', newPassword: 'Newpass123' };
    assert.equal((await c.request(null, '/reset-password-secure', body)).status, 200);
    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal((await c.request(null, '/reset-password-secure', { ...body, newPassword: 'Otherpass123' })).status, 400);
    await code(user.email, new Date(Date.now() - 1000));
    assert.equal((await c.request(null, '/reset-password-secure', { ...body, newPassword: 'Otherpass123' })).status, 400);
    assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).password, stored.password);
});

test('a failed password update rolls back token consumption', async t => {
    const c = await context(t), email = `missing@${c.prefix}.test`, token = await code(email);
    const response = await c.request(null, '/reset-password-secure', { email, code: '123456', newPassword: 'Newpass123' });
    assert.equal(response.status, 500);
    assert.deepEqual(await prisma.passwordResetToken.findUnique({ where: { id: token.id } }), token);
});
