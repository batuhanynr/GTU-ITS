import { defineConfig } from '@playwright/test';

export default defineConfig({
    forbidOnly: Boolean(process.env.CI),
    use: { baseURL: 'http://127.0.0.1:4173' },
    webServer: {
        command: 'node ../backend/tests/browser-server.js',
        url: 'http://127.0.0.1:4173/api/health',
    },
});
