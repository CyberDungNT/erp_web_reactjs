/* SERVICE WORKER – nhận THÔNG BÁO ĐẨY tin nhắn khi app đã thu nhỏ / đóng (src/realtime/push.js đăng ký file này).
 * Server (API_App_Demo/Realtime/WebPush.cs) gửi: { title, body, room, tag, url, at }
 * Không cache trang / dữ liệu – chỉ lo thông báo. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || '' }; }
  event.waitUntil((async () => {
    // App đang hiện trên màn hình -> popup trong app đã báo, không hiện thêm thông báo hệ thống
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((w) => w.visibilityState === 'visible')) return;
    await self.registration.showNotification(data.title || 'Tin nhắn mới', {
      body: data.body || '',
      tag: data.tag || 'chat',           // cùng phòng -> thay thông báo cũ
      renotify: true,                    // thay thông báo cũ vẫn rung / kêu
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',      // icon nhỏ trên thanh trạng thái Android
      timestamp: data.at ? Date.parse(data.at) : Date.now(),
      data: { room: data.room || '', url: data.url || '/' },
    });
  })());
});

// Chạm vào thông báo -> mở app (đã mở thì đưa lên trước) và vào thẳng phòng chat
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { room, url } = event.notification.data || {};
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
    if (win) {
      await win.focus();
      win.postMessage({ type: 'open-chat', room });
      return;
    }
    await self.clients.openWindow(url || '/');
  })());
});

// Trình duyệt tự đổi đăng ký (hết hạn) -> báo app đăng ký lại lần mở tới (app tự gửi lại mỗi lần mở)
self.addEventListener('pushsubscriptionchange', () => {});
