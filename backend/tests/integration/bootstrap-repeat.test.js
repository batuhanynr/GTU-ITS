import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { prisma } from '../helpers/database.js';
after(() => prisma.$disconnect());

test('repeating production bootstrap preserves an existing administrator and password', async t => {
    const email = `${randomUUID()}@bootstrap.test`;
    const departmentName = 'Bilgisayar Mühendisliği (İngilizce)';
    const existed = await prisma.department.findUnique({ where: { name: departmentName } });
    t.after(async () => {
        await prisma.user.deleteMany({ where: { email } });
        if (!existed) await prisma.department.delete({ where: { name: departmentName } });
    });
    const run = password => spawnSync(process.execPath, ['scripts/bootstrap-production.js'], {
        cwd: new URL('../../', import.meta.url), encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_PASSWORD: password }
    });
    let result = run('First-generated-password');
    assert.equal(result.status, 0, result.stderr);
    let account = await prisma.user.findUnique({ where: { email } });
    assert.equal(account.requiresPasswordChange, true);
    await prisma.user.update({ where: { email }, data: { name: 'Changed name', password: 'preserved-hash', requiresPasswordChange: false } });
    result = run('Different-generated-password');
    assert.equal(result.status, 0, result.stderr);
    account = await prisma.user.findUnique({ where: { email } });
    assert.equal(account.password, 'preserved-hash');
    assert.equal(account.name, 'Changed name');
    assert.equal(account.requiresPasswordChange, false);
    assert.equal(await prisma.user.count({ where: { email } }), 1);
});
