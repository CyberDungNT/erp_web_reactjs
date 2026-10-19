import { lazy } from 'react';
import { callProc } from '@/api/apiClient';

/**
 * MỞ MÀN HÌNH THEO KHAI BÁO TRONG DB
 *
 * Bấm 1 chức năng trên menu -> gọi CP_SysGetMenu -> cột FormInPut = TÊN FILE màn hình trong project
 * -> tự tìm file đó trong src/modules (mọi thư mục con, không cần khai báo ở đâu) và mở.
 *
 *   FormInPut = 'ReportGLSO1'  ->  mở src/modules/<bất kỳ>/ReportGLSO1.jsx  (export default component)
 *
 * Tên file không phân biệt hoa thường, có thể bỏ đuôi "Page" (FormInPut 'HangHoa' tìm cả HangHoa.jsx lẫn HangHoaPage.jsx).
 * Màn hình nhận props: { menu, menuInfo }  – menuInfo = nguyên dòng CP_SysGetMenu trả về
 *   (Name, Ma_Ct, IsVoucher, IsList, IsReport, IsCaculator, IsSystem, FormInPut, IsMaxForm, Chk_Pass, HelpName, Para, ...).
 */
export const MENU_PROC = 'CP_SysGetMenu';

// ----- Danh mục file màn hình: tên file (chữ thường) -> nạp file khi cần -----
const files = import.meta.glob(['../modules/**/*.jsx', '!../modules/_*/**']);
const loaders = new Map();
for (const [path, load] of Object.entries(files)) {
  const name = path.split('/').pop().replace(/\.jsx$/i, '').toLowerCase();
  if (loaders.has(name)) console.warn(`[menuForm] Trùng tên file màn hình '${name}': ${path} – FormInPut sẽ mở file gặp trước`);
  else loaders.set(name, { load, path: path.replace(/^\.\.\//, 'src/') });
}

const components = new Map(); // giữ nguyên 1 component lazy cho mỗi file (không tạo lại mỗi lần render)

/** Tìm màn hình theo FormInPut. Không có file -> null */
export function findForm(formName) {
  const key = String(formName || '').trim().toLowerCase();
  if (!key) return null;
  const hit = loaders.get(key) || loaders.get(`${key}page`);
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
export const isListMenu = (info) => ['1', 'true'].includes(String(info?.IsList ?? '').trim().toLowerCase());

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
