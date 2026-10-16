import { decryptText, encryptText } from '@/auth/tokenVault';
import { toast } from '@/components/cyber/CyberToast';

/**
 * BẢN NHÁP DỮ LIỆU ĐANG NHẬP – giữ được qua F5 / mất mạng / phải đăng nhập lại.
 *
 * Lưu ở sessionStorage (KHÔNG phải localStorage – xem utils/storage.js):
 *   - chỉ của tab hiện tại, đóng tab là mất;
 *   - MÃ HOÁ AES-GCM (khoá trong IndexedDB cyber_vault, giống cyber_auth) – mở DevTools không đọc được nội dung;
 *   - theo từng tài khoản + chức năng; quá DRAFT_MAX_AGE_MS thì bỏ.
 * Đăng xuất chủ động -> xoá hết (clearAllDrafts).
 *
 * Thường không gọi trực tiếp: useCyberForm / CyberForm tự dùng.
 */
const PREFIX = 'cyber_draft:';
export const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 giờ

export async function saveDraft(key, value) {
  try {
    const enc = await encryptText(JSON.stringify({ v: value, t: Date.now() }));
    sessionStorage.setItem(PREFIX + key, enc);
  } catch { /* storage đầy / bị chặn: bỏ qua, không làm phiền người dùng */ }
}

export async function loadDraft(key) {
  let raw;
  try { raw = sessionStorage.getItem(PREFIX + key); } catch { return null; }
  if (!raw) return null;
  try {
    const { v, t } = JSON.parse(await decryptText(raw));
    if (!t || Date.now() - t > DRAFT_MAX_AGE_MS) { removeDraft(key); return null; }
    return v;
  } catch {
    removeDraft(key); // hỏng / khoá đổi
    return null;
  }
}

export function removeDraft(key) {
  try { sessionStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

/** Đăng xuất chủ động -> xoá mọi bản nháp của tab */
export function clearAllDrafts() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(PREFIX)) sessionStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

// ----- Báo "đã khôi phục": gộp nhiều form của cùng 1 lần mở (vd màn có 3 form) thành 1 toast -----
let pending = [];
let timer = null;
export function notifyRestored(discard) {
  pending.push(discard);
  clearTimeout(timer);
  timer = setTimeout(() => {
    const fns = pending;
    pending = [];
    toast.info('Dữ liệu bạn đang nhập dở đã được khôi phục.', {
      title: 'Khôi phục bản nháp',
      duration: 8000,
      action: { text: 'Bỏ bản nháp', onClick: () => fns.forEach((fn) => fn()) },
    });
  }, 350);
}
