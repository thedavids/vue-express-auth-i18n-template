import { defineConfig } from 'vite';
import path from 'path';
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    root: './',
    build: {
        outDir: 'dist',
    },
    server: {
        open: '/',
    },
    resolve: {
        alias: {
            shared: path.resolve(__dirname, './shared')
        }
    }
});
