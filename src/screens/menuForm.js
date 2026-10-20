import { lazy } from 'react';
import { callProc } from '@/api/apiClient';

/**
 * MỞ MÀN HÌNH THEO KHAI BÁO TRONG DB (xem thêm src/modules/README.md)
 *
 * Bấm 1 chức năng trên menu -> gọi CP_SysGetMenu -> cờ loại (IsList / IsReport / IsVoucher / IsCaculator)
 * + cột FormInPut = TÊN FILE màn hình -> mở file đó trong THƯ MỤC CỦA LOẠI:
 *
 *   Loại        Cờ CP_SysGetMenu   Thư mục                   Mở thế nào
 *   Danh mục    IsList = 1         src/modules/danhmuc/      màn danh mục chung (ListScreen, CP_SysList); file trong
 *                                                            danhmuc/ = form Sửa / Thêm (FormInPut bảng cấu hình CP_SysList)
 *   Báo cáo     IsReport = 1       src/modules/baocao/       file <FormInPut>.jsx
 *   Chứng từ    IsVoucher = 1      src/modules/chungtu/      file <FormInPut>.jsx
 *   Tính toán   IsCaculator = 1    src/modules/calculator/   file <FormInPut>.jsx
 *   Khác        (không cờ nào)     src/modules/other/        file <FormInPut>.jsx
 *
 *   FormInPut = 'BcSoCaiTk' + IsReport = 1  ->  src/modules/baocao/BcSoCaiTk.jsx  (export default component)
 *
 * Tìm trong thư mục của loại trước; không thấy thì tìm các thư mục khác (trùng tên giữa 2 loại vẫn đúng file).
 * Tên file không phân biệt hoa thường, có thể bỏ đuôi "Page" (FormInPut 'HangHoa' tìm cả HangHoa.jsx lẫn HangHoaPage.jsx).
 * Thư mục / file bắt đầu bằng "_" (vd src/modules/_mau – file mẫu) KHÔNG được nạp.
 * Màn hình nhận props: { menu, menuInfo }  – menuInfo = nguyên dòng CP_SysGetMenu trả về
 *   (Name, Ma_Ct, IsVoucher, IsList, IsReport, IsCaculator, IsSystem, FormInPut, IsMaxForm, Chk_Pass, HelpName, Para, ...).
 */
export const MENU_PROC = 'CP_SysGetMenu';

/** 5 loại chức năng: cờ trong CP_SysGetMenu -> thư mục chứa form + file mẫu (src/modules/_mau) */
export const FORM_KINDS = [
  { key: 'list', flag: 'IsList', folder: 'danhmuc', text: 'Danh mục', sample: 'MauDanhMuc' },
  { key: 'report', flag: 'IsReport', folder: 'baocao', text: 'Báo cáo', sample: 'MauBaoCao' },
  { key: 'voucher', flag: 'IsVoucher', folder: 'chungtu', text: 'Chứng từ', sample: 'MauChungTu' },
  { key: 'calculator', flag: 'IsCaculator', folder: 'calculator', text: 'Tính toán', sample: 'MauCalculator' },
  { key: 'other', flag: null, folder: 'other', text: 'Khác', sample: 'MauKhac' },
];
const isOn = (v) => ['1', 'true'].includes(String(v ?? '').trim().toLowerCase());

/** Loại của 1 chức năng theo dòng CP_SysGetMenu (không cờ nào -> 'other') */
export const kindOf = (info) => FORM_KINDS.find((k) => k.flag && isOn(info?.[k.flag])) || FORM_KINDS[FORM_KINDS.length - 1];

// ----- Danh mục file màn hình: thư mục -> (tên file chữ thường -> nạp file khi cần) -----
const files = import.meta.glob(['../modules/**/*.jsx', '!../modules/_*/**', '!../modules/**/_*.jsx']);
const byFolder = new Map(); // 'baocao' -> Map(name -> loader)
for (const [path, load] of Object.entries(files)) {
  const parts = path.replace(/^\.\.\/modules\//, '').split('/');
  const folder = parts.length > 1 ? parts[0].toLowerCase() : '';
  const name = parts[parts.length - 1].replace(/\.jsx$/i, '').toLowerCase();
  if (!byFolder.has(folder)) byFolder.set(folder, new Map());
  const map = byFolder.get(folder);
  if (map.has(name)) console.warn(`[menuForm] Trùng tên file '${name}' trong src/modules/${folder}: ${path} – mở file gặp trước`);
  else map.set(name, { load, path: path.replace(/^\.\.\//, 'src/') });
}

const components = new Map(); // giữ nguyên 1 component lazy cho mỗi file (không tạo lại mỗi lần render)

/**
 * Tìm màn hình theo FormInPut. kind = 'list' | 'report' | 'voucher' | 'calculator' | 'other' (hoặc dòng CP_SysGetMenu).
 * Tìm thư mục của loại trước, rồi mọi thư mục khác. Không có file -> null
 */
export function findForm(formName, kind) {
  const key = String(formName || '').trim().toLowerCase();
  if (!key) return null;
  const k = typeof kind === 'string' ? FORM_KINDS.find((x) => x.key === kind) : kind ? kindOf(kind) : null;
  const look = (map) => map?.get(key) || map?.get(`${key}page`);
  let hit = k && look(byFolder.get(k.folder));
  if (!hit) for (const map of byFolder.values()) { hit = look(map); if (hit) break; }
  if (!hit) return null;
  if (!components.has(hit.path)) components.set(hit.path, { Component: lazy(hit.load), path: hit.path });
  return components.get(hit.path);
}

// ----- Gọi CP_SysGetMenu (nhớ kết quả trong phiên để mở lại chức năng không gọi lại) -----
const cache = new Map();

/**
 * @param {string} menuId  Menu_Id của chức năng
 * @param {object} user    dòng thông tin đăng nhập (useAuth().user): Ma_TTCP, User_name, TokenKey
 * @returns {Promise<object>} dòng đầu tiên của bảng kết quả (Status, Note, FormInPut...)
 */
const cacheKey = (menuId, user) => `${user?.User_name}|${user?.Ma_TTCP}|${menuId}`;

/** Xoá kết quả đã nhớ của 1 chức năng (vd bị từ chối -> lần bấm sau hỏi lại server) */
export function forgetMenuInfo(menuId, user) {
  cache.delete(cacheKey(menuId, user));
}

export function getMenuInfo(menuId, user, { refresh = false } = {}) {
  const key = cacheKey(menuId, user);
  if (!refresh && cache.has(key)) return cache.get(key);
  const run = callProc(MENU_PROC, [
    menuId,               // @M_Menu_Id
    '',                   // @M_Name       – để trống
    user?.Ma_TTCP || '',  // @M_Ma_TTCP
    user?.User_name || '',// @M_User_Name
    user?.TokenKey || '', // @M_TokenKey
    '',                   // @M_Id_Device  – để trống
  ], { silent: true }).then(({ tables }) => {
    const row = tables.find((t) => t?.length && ('FormInPut' in t[0] || 'Status' in t[0]))?.[0] || tables[0]?.[0] || null;
    if (!row) throw new Error(`${MENU_PROC} không trả về dữ liệu cho chức năng ${menuId}.`);
    return row;
  });
  cache.set(key, run);
  run.catch(() => cache.delete(key)); // lỗi -> lần sau gọi lại
  return run;
}

/** Thủ tục cho phép mở? (Status = 'Y') */
export const isMenuAllowed = (info) => String(info?.Status ?? 'Y').trim().toUpperCase() === 'Y';

/** Chức năng là danh mục? (IsList = 1) -> mở màn danh mục chung (ListScreen, gọi CP_SysList) */
export const isListMenu = (info) => kindOf(info).key === 'list';

// ----- Danh mục: CP_SysList -----
export const LIST_PROC = 'CP_SysList';

/**
 * Mã danh mục truyền vào CP_SysList (vd 'DMTK0'): lấy FormInPut, không có thì Ma_Ct / HelpName của CP_SysGetMenu
 */
export const listCodeOf = (info) => String(info?.FormInPut || info?.Ma_Ct || info?.HelpName || '').trim();

/**
 * Gọi CP_SysList (thứ tự = khai báo thủ tục):
 *   @M_Load      '0' load dữ liệu / '1' load / '2' load 1 bản ghi
 *   @M_LookUp    '1' lookup / '0' danh mục
 *   @M_Nam, @M_Tb_Name (mã danh mục, vd DMTK0), @M_strSearch, @M_strkey,
 *   @M_Ma_TTCP, @M_User_Name, @M_TokenKey, @M_Id_Device (để trống)
 * @returns {Promise<object[][]>} tất cả các bảng trả về
 */
export function loadList(code, user, { load = '1', lookup = '0', search = '', key = '' } = {}) {
  return callProc(LIST_PROC, [
    load,                                  // @M_Load
    lookup,                                // @M_LookUp
    user?.Nam || new Date().getFullYear(), // @M_Nam
    code,                                  // @M_Tb_Name
    search,                                // @M_strSearch
    key,                                   // @M_strkey
    user?.Ma_TTCP || '',                   // @M_Ma_TTCP
    user?.User_name || '',                 // @M_User_Name
    user?.TokenKey || '',                  // @M_TokenKey
    '',                                    // @M_Id_Device – để trống
  ], { silent: true }).then(({ tables }) => tables);
}
