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
import { decryptText, encryptText } from './tokenVault';

export const LOGIN_PROC = 'CP_SysLogin';

/**
 * LẤY DANH SÁCH ĐƠN VỊ khi rời ô tài khoản:
 *   EXECUTE dbo.CP_SysGetUnits N'01', N'<tài khoản>'
 * Trả về: bảng đơn vị (Ma_Dvcs, Ma_TTCP, Ten_TTCP, Ngay_KS) + bảng mặc định của user (M_LAN, Ma_TTCP, Ten_TTCP).
 */
export const UNITS_PROC = 'CP_SysGetUnits';
export const unitsConfig = {
  firstParam: '01', // tham số thứ nhất của CP_SysGetUnits
};

export async function getUnits(userName) {
  const res = await callProc(UNITS_PROC, [unitsConfig.firstParam, userName]);
  const tables = res.tables;
  const units = tables.find((t) => hasCols(t, 'Ma_TTCP', 'Ten_TTCP') && !hasCols(t, 'M_LAN') && !hasCols(t, 'M_Lan')) || [];
  const def = tables.find((t) => hasCols(t, 'M_LAN') || hasCols(t, 'M_Lan'))?.[0] || null;
  const lang = def ? String(def.M_LAN ?? def.M_Lan ?? '').toUpperCase() : '';
  return { units, defaultUnit: def, lang: lang === 'E' ? 'E' : lang === 'V' ? 'V' : '' };
}

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

/** Lấy dữ liệu menu trái / menu trên từ phiên đăng nhập theo MENU_TABLE */
export function getMenuRows(session) {
  const tables = session?.tables || [];
  return { left: tables[MENU_TABLE.left] || [], top: tables[MENU_TABLE.top] || [] };
}

// Đổi số này khi cấu trúc bản ghi token thay đổi -> bản ghi cũ tự bị bỏ, phải đăng nhập lại
const TOKEN_VERSION = 2;
const TOKEN_KEY = 'cyber_auth';
const LEGACY_SESSION_KEY = 'cyber_session';
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
    tables, // lưu nguyên các bảng; menu trái/trên lấy theo MENU_TABLE lúc hiển thị (getMenuRows)
    dashboards: tables.find((t) => hasCols(t, 'PageName')) || [],
  };
}

/**
 * Gọi đăng nhập.
 * @returns {Promise<{ok:boolean, message:string, info:object, tables?:any[][], dashboards?:[]}>}
 */
export async function login({ userName, password = '', maTTCP, tokenKey = '', otp = '', idOtp = '' }) {
  const params = [
    loginConfig.type,
    loginConfig.platform,
    userName,
    password,
    tokenKey,    // @M_TokenKey – rỗng khi đăng nhập bằng mật khẩu, có giá trị khi tự đăng nhập lại bằng token
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

// ===== Ghi nhớ đăng nhập bằng TokenKey đã mã hoá =====
// Đăng nhập thành công -> mã hoá NGUYÊN bản ghi (tokenVault: AES-GCM) rồi lưu localStorage[TOKEN_KEY]:
//   "v2:<base64( IV + mã hoá JSON { tokenKey, userName, maTTCP, lang, savedAt } )>"
//   -> nhìn localStorage không đọc được tài khoản, đơn vị hay token.
// Lần sau mở web -> giải mã -> gọi lại CP_SysLogin với @M_TokenKey (không cần mật khẩu) để lấy menu / quyền mới nhất.
// Không lưu menu / thông tin phiên ra trình duyệt nữa: phiên chỉ nằm trong bộ nhớ.

const TOKEN_PREFIX = `v${TOKEN_VERSION}:`;

const readRaw = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};

/** Có bản ghi đăng nhập đã lưu không (để màn hình biết đang tự đăng nhập lại) */
export function hasSavedToken() {
  return readRaw().startsWith(TOKEN_PREFIX);
}

/** Giải mã bản ghi đã lưu. Không có / sai khoá / bị sửa -> null (và xoá bản ghi hỏng) */
async function readRecord() {
  const raw = readRaw();
  if (!raw.startsWith(TOKEN_PREFIX)) return null;
  try {
    const rec = JSON.parse(await decryptText(raw.slice(TOKEN_PREFIX.length)));
    return rec?.tokenKey ? rec : null;
  } catch {
    clearToken(); // khoá đã đổi / dữ liệu bị sửa -> bỏ, đăng nhập lại bằng mật khẩu
    return null;
  }
}

async function writeRecord(rec) {
  const enc = await encryptText(JSON.stringify(rec));
  try { localStorage.setItem(TOKEN_KEY, TOKEN_PREFIX + enc); } catch { /* bộ nhớ đầy / bị chặn */ }
}

/** Mã hoá + lưu TokenKey kèm tài khoản, đơn vị, ngôn ngữ */
export async function saveToken({ tokenKey, userName, maTTCP, lang }) {
  if (!tokenKey) return;
  await writeRecord({ tokenKey, userName, maTTCP, lang, savedAt: new Date().toISOString() });
}

/** Cập nhật thông tin phụ (vd. ngôn ngữ) mà không đổi token: giải mã -> sửa -> mã hoá lại */
export async function updateSavedToken(patch) {
  const rec = await readRecord();
  if (rec) await writeRecord({ ...rec, ...patch });
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

/**
 * Tự đăng nhập lại bằng token đã lưu: giải mã -> CP_SysLogin(@M_TokenKey).
 * @returns {Promise<null | {ok, message, info, tables, dashboards, userName, maTTCP, lang, tokenKey}>}
 *          null = không có token hợp lệ để thử.
 */
export async function loginWithSavedToken() {
  const rec = await readRecord();
  if (!rec) return null;
  const res = await login({ userName: rec.userName, maTTCP: rec.maTTCP, tokenKey: rec.tokenKey });
  // Thủ tục có thể cấp token mới; không trả thì giữ token cũ
  return { ...res, userName: rec.userName, maTTCP: rec.maTTCP, lang: rec.lang, tokenKey: res.info?.TokenKey || rec.tokenKey };
}

/** Dọn dữ liệu kiểu cũ còn dạng chữ rõ: phiên đầy đủ (menu + TokenKey) và bản ghi token v1 lộ tài khoản */
export function clearLegacySession() {
  try {
    localStorage.removeItem(LEGACY_SESSION_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
    const raw = readRaw();
    if (raw && !raw.startsWith(TOKEN_PREFIX)) clearToken();
  } catch { /* ignore */ }
}

/** Nhớ tên đăng nhập + đơn vị lần trước (không lưu mật khẩu) */
export function getLastLogin() {
  try { return JSON.parse(localStorage.getItem(LAST_LOGIN_KEY)) || {}; } catch { return {}; }
}
export function setLastLogin(v) {
  try { localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}
