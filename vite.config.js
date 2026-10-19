import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Thông tin bản build: ghi dist/version.json + thẻ <meta name="app-build"> trong index.html.
 * Web so meta app-build với /version.json trên server -> biết đã có bản mới (src/utils/appVersion.js),
 * màn "Cập nhật hệ thống" hiển thị bản đang chạy.
 * KHÔNG nhúng vào file JS: để code không đổi thì tên file JS (mã băm) cũng không đổi -> mỗi lần cập nhật chỉ gửi file thật sự đổi.
 */
function buildInfo() {
  let commit = '';
  try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* không có git */ }
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const builtAt = new Date().toISOString();
  return { version: pkg.version, commit, builtAt, id: `${pkg.version}-${commit || 'local'}-${Date.parse(builtAt).toString(36)}` };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const info = buildInfo();
  return {
    plugins: [
      react(),
      {
        name: 'erp-version-json',
        apply: 'build',
        generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(info, null, 2) }); },
        // dạng "id|version|commit|builtAt" (không dấu nháy – JSON trong thuộc tính HTML bị Vite ghi \" làm hỏng thẻ)
        transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'app-build', content: [info.id, info.version, info.commit, info.builtAt].join('|') }, injectTo: 'head' }],
      },
    ],
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
