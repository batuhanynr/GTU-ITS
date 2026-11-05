import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import app from '../src/server.js';

test('health detects a database failure without exposing connection details', async () => {
    const original = prisma.$queryRaw;
    const server = app.listen(0, '127.0.0.1');
    try {
        await new Promise(resolve => server.on('listening', resolve));
        const url = `http://127.0.0.1:${server.address().port}/api/health`;
        prisma.$queryRaw = async () => [{ result: 1 }];
        let response = await fetch(url);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: 'ok' });
        prisma.$queryRaw = async () => { throw new Error('private connection details'); };
        response = await fetch(url);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { status: 'unavailable' });
    } finally {
        prisma.$queryRaw = original;
        await new Promise(resolve => server.close(resolve));
    }
});
