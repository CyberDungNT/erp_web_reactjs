/**
 * HÀM GỌI API DÙNG CHUNG
 * ---------------------------------------------------------------
 * Backend: POST /api/Data/execute  { Name, Para }  ->  { Status, Message, Data }
 *
 * Cách dùng:
 *   import { callProc } from '@/api/apiClient';
 *
 *   const res = await callProc('GetData', [1, 2]);       // Para = "1#2"
 *   const res = await callProc('GetData', '1#2');        // truyền chuỗi sẵn cũng được
 *   res.table    -> bảng đầu tiên (mảng các dòng)
 *   res.tables   -> tất cả các bảng trong DataSet
 *   res.message  -> Message từ server
 *
 * Nếu Status = false hoặc lỗi mạng -> throw ApiError (có .message).
 */
import { mockExecute } from '@/api/mock';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK).toLowerCase() === 'true';
const EXECUTE_URL = `${BASE_URL}/api/Data/execute`;

export const apiConfig = { BASE_URL, USE_MOCK, EXECUTE_URL };

export class ApiError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'ApiError';
    this.detail = detail;
  }
}

/** Ghép mảng tham số thành chuỗi "a#b#c". null/undefined -> chuỗi rỗng. */
export function buildPara(params) {
  if (params === undefined || params === null) return null;
  if (typeof params === 'string') return params;
  if (!Array.isArray(params)) params = [params];
  return params
    .map((p) => {
      if (p === null || p === undefined) return '';
      if (typeof p === 'boolean') return p ? '1' : '0';
      if (p instanceof Date) return toSqlDate(p);
      return String(p);
    })
    .join('#');
}

function toSqlDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Chuẩn hoá Data trả về từ ds.ToJsonObject() thành mảng các bảng.
 * Hỗ trợ các dạng thường gặp:
 *   { Table: [...], Table1: [...] }   -> [[...], [...]]
 *   [[...], [...]]                    -> giữ nguyên
 *   [{...}, {...}]                    -> [[{...}, {...}]]
 *   chuỗi JSON                        -> parse rồi xử lý như trên
 */
export function normalizeTables(data) {
  if (data === null || data === undefined) return [];
  if (typeof data === 'string') {
    try {
      return normalizeTables(JSON.parse(data));
    } catch {
      return [[{ Value: data }]];
    }
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return [[]];
    if (Array.isArray(data[0])) return data;
    return [data];
  }
  if (typeof data === 'object') {
    const values = Object.values(data);
    if (values.length && values.every(Array.isArray)) return values;
    return [[data]];
  }
  return [[{ Value: data }]];
}

/**
 * Gọi stored procedure.
 * @param {string} name     Tên proc
 * @param {Array|string} [params]  Mảng tham số hoặc chuỗi "a#b"
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<{tables: any[][], table: any[], message: string, raw: any}>}
 */
export async function callProc(name, params, options = {}) {
  const body = { Name: name, Para: buildPara(params) };

  let json;
  if (USE_MOCK) {
    json = await mockExecute(body);
  } else {
    let resp;
    try {
      resp = await fetch(EXECUTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new ApiError('Không kết nối được tới server: ' + err.message, err);
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new ApiError(`Lỗi HTTP ${resp.status}`, text);
    }
    json = await resp.json();
  }

  // Server .NET mặc định trả camelCase (status/message/data), hỗ trợ cả PascalCase
  const status = json.status ?? json.Status;
  const message = json.message ?? json.Message ?? '';
  const data = json.data ?? json.Data;

  if (!status) throw new ApiError(message || 'Lỗi không xác định', json);

  const tables = normalizeTables(data);
  return { tables, table: tables[0] || [], message, raw: json };
}
