import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // import tuyệt đối từ src: import { CyberForm } from '@/components/cyber';
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 3000,
      // Proxy /api sang backend .NET để tránh lỗi CORS khi chạy dev
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'https://localhost:7001',
          changeOrigin: true,
          secure: false,
        },
        // Hub realtime SignalR (WebSocket) – xem src/realtime/socket.js
        '/hubs': {
          // Hub nằm chung API_App_Demo -> dùng VITE_API_TARGET. Hub ở server khác thì đặt VITE_SOCKET_TARGET
          target: env.VITE_SOCKET_TARGET || env.VITE_API_TARGET || 'https://localhost:7001',
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  };
});
