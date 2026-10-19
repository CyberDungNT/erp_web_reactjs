/**
 * PHIÊN BẢN GIAO DIỆN WEB
 *   APP_BUILD = thông tin bản đang chạy trong trình duyệt – thẻ <meta name="app-build"> vite.config.js ghi vào index.html
 *               lúc build: { version, commit, builtAt, id } (npm run dev: { id: 'dev' })
 *   checkNewVersion() đọc /version.json trên server: khác id -> đã có bản mới (vừa cập nhật qua "Cập nhật hệ thống")
 *   watchNewVersion(onNew) kiểm tra định kỳ + khi quay lại tab -> báo người dùng tải lại
 */
const readBuild = () => {
  const raw = document.querySelector('meta[name="app-build"]')?.content || '';
  const [id, version, commit, builtAt] = raw.split('|');
  return id ? { id, version, commit, builtAt } : { id: 'dev' };
};
export const APP_BUILD = readBuild();

export async function fetchServerVersion() {
  const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function checkNewVersion() {
  if (APP_BUILD.id === 'dev') return null; // npm run dev: không kiểm tra
  try {
    const v = await fetchServerVersion();
    return v?.id && v.id !== APP_BUILD.id ? v : null;
  } catch { return null; }
}

/** Kiểm tra bản mới mỗi `everyMs` (mặc định 5 phút) và khi người dùng quay lại tab. Trả hàm huỷ */
export function watchNewVersion(onNew, everyMs = 5 * 60 * 1000) {
  let notified = false;
  const run = async () => {
    if (notified) return;
    const v = await checkNewVersion();
    if (v) { notified = true; onNew(v); }
  };
  const t = setInterval(run, everyMs);
  const onVis = () => { if (!document.hidden) run(); };
  document.addEventListener('visibilitychange', onVis);
  return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
}

export const formatBuild = (b) => (b ? [b.version && `v${b.version}`, b.commit, b.builtAt && new Date(b.builtAt).toLocaleString('vi-VN')].filter(Boolean).join(' · ') : '—');
