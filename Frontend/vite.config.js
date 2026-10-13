import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    // In development the API is proxied so cookies stay first-party (same origin).
    const target = env.VITE_DEV_API_PROXY || 'http://localhost:5000';
    return {
        plugins: [react(), tailwindcss()],
        server: {
            port: 5173,
            proxy: {
                '/api': { target, changeOrigin: false },
                '/media': { target, changeOrigin: false },
                '/sitemap.xml': { target, changeOrigin: false },
                '/robots.txt': { target, changeOrigin: false },
            },
        },
        build: {
            sourcemap: false,
            rollupOptions: {
                output: {
                    manualChunks: {
                        react: ['react', 'react-dom', 'react-router-dom'],
                        charts: ['recharts'],
                        firebase: ['firebase/app', 'firebase/messaging'],
                    },
                },
            },
        },
    };
});
