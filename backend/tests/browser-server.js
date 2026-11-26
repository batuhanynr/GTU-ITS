import express from 'express';
import { fileURLToPath } from 'node:url';

const database = new URL(process.env.DATABASE_URL || 'postgresql://invalid/');
if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/gtu_[a-z0-9_]*test$/.test(database.pathname)) {
    throw new Error('Use a local gtu_*test database for the browser checks.');
}

const { default: app } = await import('../src/server.js');
const build = fileURLToPath(new URL('../../frontend-new/build/', import.meta.url));
const server = express();

// Serve the built app on the API's origin so the browser uses real requests.
server.use(express.static(build));
server.use(app);
server.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: build }));
server.listen(4173, '127.0.0.1');
