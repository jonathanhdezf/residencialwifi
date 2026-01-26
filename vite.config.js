import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                admin: resolve(__dirname, 'admin.html'),
                dashboard: resolve(__dirname, 'dashboard.html'),
                register: resolve(__dirname, 'register.html'),
                landing: resolve(__dirname, 'landing.html'),
            },
        },
    },
});
