/**
 * ĐĂNG NHẬP qua thủ tục CP_SysLogin
 * ---------------------------------------------------------------
 * exec CP_SysLogin @M_Type, @M_PlatForm, @M_User_Name, @M_Password, @M_TokenKey,
 *                  @M_Ma_OTP, @M_Id_OTP, @M_Ma_TTCP, @M_MacAddress, @M_UserWindow, @M_Id_Device
 *
 * Kết quả:
 *   - Bảng MENU_TABLE.left (mặc định bảng 0) -> menu bên trái (cây Menu_Id / Menu_Id0)
 *   - Bảng MENU_TABLE.top  (mặc định bảng 1) -> menu trên cùng (cây Menu_Id / Menu_Id0)
 *   - Bảng có cột PageName           -> danh sách dashboard trang chủ
 *   - Bảng có cột status + TokenKey  -> thông tin đăng nhập (status 'Y' = thành công, Note = thông báo)
 *     (2 bảng này tìm theo cột vì khi đăng nhập sai thứ tự bảng khác khi đúng)
 */
import { callProc } from '../api/apiClient';

export const LOGIN_PROC = 'CP_SysLogin';

// Các tham số cố định – sửa ở đây nếu backend cần giá trị khác
export const loginConfig = {
  type: '1',        // @M_Type
  platform: '1',    // @M_PlatForm
  macAddress: '',   // @M_MacAddress – trình duyệt không đọc được MAC
  userWindow: '',   // @M_UserWindow – trình duyệt không đọc được user Windows
};

/**
 * VỊ TRÍ BẢNG MENU trong kết quả CP_SysLogin khi đăng nhập thành công (đếm từ 0: Table = 0, Table1 = 1...).
 * Muốn đổi menu trái/menu trên thì chỉ cần sửa 2 số này.
 */
export const MENU_TABLE = {
  left: 0, // bảng 0 -> menu bên trái
  top: 1,  // bảng 1 -> menu trên cùng
};

const SESSION_KEY = 'cyber_session';
const DEVICE_KEY = 'cyber_device_id';
const LAST_LOGIN_KEY = 'cyber_last_login';

/** Mã thiết bị: chuỗi hex 64 ký tự, sinh 1 lần và lưu lại trên trình duyệt (thay cho @M_Id_Device) */
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

const hasCols = (table, ...cols) => !!table?.[0] && cols.every((c) => c in table[0]);

/** Phân tích các bảng trả về từ CP_SysLogin */
export function parseLoginResult(tables) {
  const infoTable = [...tables].reverse().find((t) => hasCols(t, 'status', 'TokenKey'));
  const info = infoTable?.[0];
  if (!info) throw new Error('Kết quả đăng nhập không đúng định dạng (không có dòng status/TokenKey).');

  const ok = String(info.status).trim().toUpperCase() === 'Y';
  if (!ok) {
    return { ok: false, message: info.Note || 'Đăng nhập không thành công', info };
  }
  return {
    ok: true,
    message: info.Note || 'Đăng nhập thành công',
    info,
    leftMenu: tables[MENU_TABLE.left] || [],
    topMenu: tables[MENU_TABLE.top] || [],
    dashboards: tables.find((t) => hasCols(t, 'PageName')) || [],
  };
}

/**
 * Gọi đăng nhập.
 * @returns {Promise<{ok:boolean, message:string, info:object, topMenu?:[], leftMenu?:[], dashboards?:[]}>}
 */
export async function login({ userName, password, maTTCP, otp = '', idOtp = '' }) {
  const params = [
    loginConfig.type,
    loginConfig.platform,
    userName,
    password,
    '',          // @M_TokenKey
    otp,         // @M_Ma_OTP
    idOtp,       // @M_Id_OTP
    maTTCP,
    loginConfig.macAddress,
    loginConfig.userWindow,
    getDeviceId(),
  ];
  const res = await callProc(LOGIN_PROC, params);
  return parseLoginResult(res.tables);
}

// ===== Lưu phiên =====
// remember = true  -> localStorage (giữ đăng nhập khi tắt trình duyệt)
// remember = false -> sessionStorage (đóng tab là mất)
export function saveSession(session, remember) {
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  try { store.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* bộ nhớ đầy/bị chặn */ }
}

export function isRemembered() {
  try { return !!localStorage.getItem(SESSION_KEY); } catch { return false; }
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

/** Nhớ tên đăng nhập + đơn vị lần trước (không lưu mật khẩu) */
export function getLastLogin() {
  try { return JSON.parse(localStorage.getItem(LAST_LOGIN_KEY)) || {}; } catch { return {}; }
}
export function setLastLogin(v) {
  try { localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}
