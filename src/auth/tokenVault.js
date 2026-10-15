/**
 * KÉT TOKEN – mã hoá TokenKey trước khi lưu vào localStorage.
 * ---------------------------------------------------------------
 * - Thuật toán: AES-GCM 256 bit (Web Crypto), mỗi lần mã hoá dùng IV ngẫu nhiên 12 byte.
 * - Khoá: sinh ngẫu nhiên 1 lần trên trình duyệt, tạo ở dạng KHÔNG XUẤT ĐƯỢC (non-extractable)
 *   và cất trong IndexedDB -> JS chỉ dùng khoá để mã hoá / giải mã chứ không đọc được giá trị khoá.
 *   Copy localStorage sang máy / trình duyệt khác sẽ không giải mã được.
 * - Trình duyệt chặn IndexedDB (vd. một số chế độ ẩn danh): dùng khoá dẫn xuất PBKDF2 từ mã thiết bị (yếu hơn).
 *
 * Lưu ý: mã hoá phía trình duyệt chống lộ token khi file / ổ đĩa / localStorage bị sao chép,
 * nhưng không chống được mã độc chạy ngay trong trang (XSS) – mã đó có thể gọi giải mã như app.
 */

const DB_NAME = 'cyber_vault';
const STORE = 'keys';
const KEY_ID = 'token-key';
const FALLBACK_SALT = 'cyber-erp/token-vault/v1';

let keyPromise = null;

/** Lấy (hoặc tạo lần đầu) khoá AES-GCM dùng để mã hoá token */
function getKey() {
  if (!keyPromise) {
    keyPromise = loadOrCreateKey().catch((err) => {
      keyPromise = null; // lần sau thử lại
      throw err;
    });
  }
  return keyPromise;
}

async function loadOrCreateKey() {
  if (!globalThis.crypto?.subtle) throw new Error('Trình duyệt không hỗ trợ Web Crypto (cần HTTPS hoặc localhost).');
  try {
    const db = await openDb();
    const existing = await idbGet(db, KEY_ID);
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await idbPut(db, KEY_ID, key);
    return key;
  } catch {
    return fallbackKey();
  }
}

/** Khoá dự phòng khi không dùng được IndexedDB: PBKDF2(mã thiết bị) */
async function fallbackKey() {
  const { getDeviceId } = await import('./authService');
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(getDeviceId() || 'cyber'), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(FALLBACK_SALT), iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

/** Mã hoá chuỗi -> base64(IV 12 byte + ciphertext) */
export async function encryptText(plain) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(plain)));
  const out = new Uint8Array(iv.length + data.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(data), iv.length);
  return toBase64(out);
}

/** Giải mã chuỗi do encryptText tạo ra. Sai khoá / dữ liệu bị sửa -> throw */
export async function decryptText(b64) {
  const key = await getKey();
  const bytes = fromBase64(b64);
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plain);
}

// ---------------- IndexedDB ----------------
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbGet(db, id) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbPut(db, id, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------- base64 ----------------
function toBase64(bytes) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}
function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}
