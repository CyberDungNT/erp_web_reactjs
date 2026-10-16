/**
 * GỌI API FILE (backend: API_App_Demo/Controllers/FileController.cs)
 * ---------------------------------------------------------------
 *   const [saved] = await uploadFile(file, { onProgress: (pct) => ..., signal });
 *   saved -> { id, name, size, contentType, uploadedAt, uploadedBy, url }
 *   fileUrl(saved)                      -> link xem (ảnh/pdf mở trên trình duyệt)
 *   fileUrl(saved, { download: true })  -> link tải về
 *   await deleteFile(saved.id)
 *
 * Lưu "id" vào DB (vd cột FileId của chứng từ) để lấy lại file sau này: fileUrl(id).
 * Lỗi -> throw ApiError + tự bật toast (truyền { silent: true } để tự xử lý).
 * VITE_USE_MOCK=true -> giả lập (file giữ trong bộ nhớ trình duyệt, không gửi lên server).
 */
import { apiConfig, ApiError } from '@/api/apiClient';
import { reportError } from '@/utils/errorReporter';

const FILE_API = `${apiConfig.BASE_URL}/api/File`;

/** Link xem / tải 1 file. Nhận object file đã lưu, hoặc id. */
export function fileUrl(fileOrId, { download = false } = {}) {
  if (!fileOrId) return '';
  if (typeof fileOrId === 'object' && fileOrId.mockUrl) return fileOrId.mockUrl;
  const id = typeof fileOrId === 'string' ? fileOrId : fileOrId.id;
  return `${FILE_API}/${encodeURIComponent(id)}${download ? '?download=true' : ''}`;
}

/**
 * Tải 1 file lên. Trả về Promise<StoredFile[]> (mảng 1 phần tử – giống API trả về).
 * @param {File} file
 * @param {{ user?: string, onProgress?: (pct:number)=>void, signal?: AbortSignal, silent?: boolean }} opts
 */
export function uploadFile(file, opts = {}) {
  const run = apiConfig.USE_MOCK ? mockUpload(file, opts) : xhrUpload(file, opts);
  return run.catch((err) => {
    if (!opts.silent && err?.name !== 'AbortError') reportError(err, { source: 'api', title: `Không tải lên được "${file.name}"` });
    throw err;
  });
}

/** Xoá file trên server */
export async function deleteFile(id, { silent = false } = {}) {
  try {
    if (apiConfig.USE_MOCK) { mockStore.delete(id); return true; }
    const res = await fetch(`${FILE_API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!(json.status ?? json.Status)) throw new ApiError(json.message ?? json.Message ?? `Lỗi HTTP ${res.status}`, json);
    return true;
  } catch (err) {
    if (!silent) reportError(err, { source: 'api', title: 'Không xoá được file' });
    throw err;
  }
}

// ----------------------------------------------------------------- XHR (có tiến trình tải lên – fetch chưa hỗ trợ)
function xhrUpload(file, { user, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('files', file, file.name);
    if (user) fd.append('user', user);

    xhr.open('POST', `${FILE_API}/upload`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      const json = xhr.response || {};
      const ok = json.status ?? json.Status;
      if (xhr.status >= 200 && xhr.status < 300 && ok) return resolve(json.data ?? json.Data ?? []);
      if (xhr.status === 413) return reject(new ApiError('File quá lớn – máy chủ từ chối.', json));
      reject(new ApiError(json.message ?? json.Message ?? `Lỗi HTTP ${xhr.status}`, json));
    };
    xhr.onerror = () => reject(new ApiError('Không kết nối được tới server khi tải file.'));
    xhr.onabort = () => { const e = new Error('Đã huỷ tải lên'); e.name = 'AbortError'; reject(e); };
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(fd);
  });
}

// ----------------------------------------------------------------- Giả lập (VITE_USE_MOCK=true)
const mockStore = new Map();
function mockUpload(file, { user, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    let pct = 0;
    const timer = setInterval(() => {
      pct = Math.min(100, pct + 8 + Math.random() * 18);
      onProgress?.(Math.round(pct));
      if (pct < 100) return;
      clearInterval(timer);
      const id = `mock-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const saved = {
        id, name: file.name, size: file.size, contentType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(), uploadedBy: user || null, url: '', mockUrl: URL.createObjectURL(file),
      };
      mockStore.set(id, saved);
      resolve([saved]);
    }, 120);
    signal?.addEventListener('abort', () => {
      clearInterval(timer);
      const e = new Error('Đã huỷ tải lên'); e.name = 'AbortError'; reject(e);
    }, { once: true });
  });
}
