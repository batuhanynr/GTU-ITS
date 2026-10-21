import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import userRoutes from '../src/routes/userRoutes.js';
import departmentRoutes from '../src/routes/departmentRoutes.js';
import studentRoutes from '../src/routes/studentRoutes.js';
import internshipRoutes from '../src/routes/internshipRoutes.js';

process.env.JWT_SECRET = 'test-only-secret';
test('anonymous requests cannot reach protected APIs', async () => {
    const app = express();
    app.use(express.json());
    app.use(userRoutes, departmentRoutes, studentRoutes, internshipRoutes);
    const server = app.listen(0);
    try {
        for (const [method, path] of [
            ['GET', '/kullanicilar'], ['POST', '/kullanici'], ['GET', '/terms'],
            ['GET', '/students/1/1'], ['GET', '/student/1'], ['POST', '/student'],
            ['GET', '/departments'], ['POST', '/create-commission-chair'],
            ['DELETE', '/remove-commission-chair/1'], ['POST', '/create-commission-member'],
            ['DELETE', '/remove-commission-member/1'], ['POST', '/internship/parse-pdf']
        ]) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method });
            assert.equal(response.status, 401, `${method} ${path}`);
        }
    } finally { server.close(); }
});
test('members cannot manage accounts and chairs cannot manage another department', async () => {
    const app = express();
    app.use(express.json());
    app.locals.prisma = { user: { findUnique: async () => ({ role: { name: role }, departmentId: 1 }) } };
    app.use(userRoutes, departmentRoutes);
    let role = 'Commission Member';
    const server = app.listen(0);
    const headers = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' };
    try {
        for (const path of ['/kullanici', '/create-commission-chair', '/create-commission-member']) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST', headers, body: '{}' });
            assert.equal(response.status, 403);
        }
        role = 'Commission Chair';
        const response = await fetch(`http://127.0.0.1:${server.address().port}/create-commission-member`, {
            method: 'POST', headers, body: JSON.stringify({ departmentId: 2 })
        });
        assert.equal(response.status, 403);
    } finally { server.close(); }
});
test('admin creation requests must include an explicit role', async () => {
    const app = express();
    app.use(express.json());
    app.locals.prisma = { user: { findUnique: async () => ({ role: { name: 'General Admin' } }) } };
    app.use(userRoutes);
    const server = app.listen(0);
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/kullanici`, {
            method: 'POST', headers: { Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'test', email: 'test@example.com', password: 'test-only-password' })
        });
        assert.equal(response.status, 400);
    } finally { server.close(); }
});
