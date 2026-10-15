import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 3000,
      // Proxy /api sang backend .NET để tránh lỗi CORS khi chạy dev
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'https://localhost:7001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
