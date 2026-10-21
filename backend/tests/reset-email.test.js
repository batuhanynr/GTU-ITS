import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import prisma from '../src/config/prisma.js';
import { forgotPassword } from '../src/controllers/authController.js';

test('password reset reports missing settings and delivery failures accurately', async () => {
    const env = [process.env.EMAIL_USER, process.env.EMAIL_PASS];
    const original = [nodemailer.createTransport, prisma.user.findUnique, prisma.passwordResetToken.deleteMany, prisma.passwordResetToken.create];
    let reads = 0, mails = 0, saved, deleted;
    prisma.user.findUnique = async () => { reads++; return { id: 1 }; };
    prisma.passwordResetToken.deleteMany = async ({ where }) => { deleted = where; };
    prisma.passwordResetToken.create = async ({ data }) => { saved = data; };
    let failure = false;
    nodemailer.createTransport = () => ({ sendMail: async options => {
        mails++; assert.equal(options.to, 'student@example.org');
        if (failure) throw new Error('SMTP unavailable');
        return { accepted: [options.to] };
    } });
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    try {
        delete process.env.EMAIL_USER; delete process.env.EMAIL_PASS;
        await forgotPassword({ body: { email: 'student@example.org' } }, res);
        assert.equal(res.statusCode, 503); assert.equal(reads, 0); assert.equal(mails, 0);
        process.env.EMAIL_USER = 'sender@example.org'; process.env.EMAIL_PASS = 'test-only-password';
        res.statusCode = 200;
        await forgotPassword({ body: { email: 'student@example.org' } }, res);
        assert.equal(res.statusCode, 200); assert.equal(mails, 1); assert.match(saved.token, /^\d{6}$/);
        assert.equal(res.body.message, 'Doğrulama kodu e-posta adresinize gönderildi.');
        failure = true;
        await forgotPassword({ body: { email: 'student@example.org' } }, res);
        assert.equal(res.statusCode, 502); assert.equal(mails, 2);
        assert.deepEqual(deleted, { email: 'student@example.org', token: saved.token });
        assert.equal(res.body.message, undefined);
    } finally {
        [nodemailer.createTransport, prisma.user.findUnique, prisma.passwordResetToken.deleteMany, prisma.passwordResetToken.create] = original;
        for (const [key, value] of [['EMAIL_USER', env[0]], ['EMAIL_PASS', env[1]]]) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
    }
});
