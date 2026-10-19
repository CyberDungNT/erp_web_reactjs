import { useEffect, useRef, useState } from 'react';
import { CyberPopup, msgbox, toast, formatSize } from '@/components/cyber';
import Icon from '@/components/icons/Icon';
import { apiConfig } from '@/api/apiClient';
import { APP_BUILD, formatBuild } from '@/utils/appVersion';
import './deploy.css';

/**
 * CẬP NHẬT HỆ THỐNG (menu avatar – chỉ quản trị viên)
 *   - Xem phiên bản giao diện web / API đang chạy trên server
 *   - Tải lên gói .zip để cập nhật (web: thư mục dist, API: thư mục publish) -> server tự chép file, API tự khởi động lại
 *   - Lịch sử cập nhật + quay lại bản trước
 * Server: API_App_Demo/Controllers/DeployController.cs – cần cấu hình Deploy:Key (+ Deploy:WebPath) trên server.
 * Làm từ máy dev bằng 1 lệnh: npm run deploy (scripts/deploy.mjs)
 */
const BASE = `${apiConfig.BASE_URL}/api/Deploy`;
let sessionKey = ''; // chỉ giữ trong bộ nhớ (không lưu trình duyệt) – tải lại trang phải nhập lại
// TokenKey của phiên đăng nhập – server bật Deploy:AdminLogin = true thì tài khoản Is_Admin = 1 cập nhật được không cần khoá
let sessionToken = '';

/** Header xác thực: có khoá -> gửi khoá (cách 1, như cũ); luôn gửi kèm TokenKey (cách 2 – server tự quyết có nhận không) */
const authHeaders = () => ({
  ...(sessionKey ? { 'X-Deploy-Key': sessionKey } : {}),
  ...(sessionToken ? { 'X-Token-Key': sessionToken } : {}),
});

const TARGETS = [
  { key: 'web', text: 'Giao diện web', hint: 'nén thư mục dist sau khi npm run build' },
  { key: 'api', text: 'API (máy chủ)', hint: 'nén thư mục kết quả dotnet publish – API tự khởi động lại' },
];

async function readError(res) {
  const body = await res.json().catch(() => null);
  return body?.detail || body?.title || `Lỗi ${res.status}`;
}

async function call(path, opts = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  } catch {
    throw new Error('Không kết nối được API.');
  }
  if (!res.ok) { const e = new Error(await readError(res)); e.status = res.status; throw e; }
  return res.json();
}

/** Tải gói lên có tiến độ (fetch chưa báo được % tải lên) */
function upload(target, file, query, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/${target}?${new URLSearchParams(query)}`);
    Object.entries(authHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.setRequestHeader('Content-Type', 'application/zip');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body = null; try { body = JSON.parse(xhr.responseText); } catch { /* không phải json */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(body?.detail || body?.title || `Lỗi ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải gói cập nhật lên.'));
    xhr.send(file);
  });
}

/** Chờ API khởi động lại xong (startedAt đổi) */
async function waitApiRestart(prevStartedAt, timeoutMs = 90000) {
  const end = Date.now() + timeoutMs;
  await new Promise((r) => setTimeout(r, 2500));
  while (Date.now() < end) {
    try {
      const info = await call('/info');
      if (info.api?.startedAt !== prevStartedAt) return info;
    } catch { /* đang khởi động */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—');

export default function DeployPanel({ open, onClose, user }) {
  const [key, setKey] = useState(sessionKey);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState('web');
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(null);   // null | 0..100 | 'restart'
  const [drag, setDrag] = useState(false);
  const [tab, setTab] = useState('rel');
  const fileRef = useRef(null);
  const busy = progress != null;

  const [mode, setMode] = useState(null);           // { enabled, adminLogin, keyEnabled } – server trả (GET /api/Deploy/mode)
  // Lúc mở: chỉ hiện 1 trạng thái "đang kiểm tra" tới khi biết kết quả (tránh nháy ô nhập khoá -> màn cập nhật)
  const [checking, setChecking] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setInfo(await call('/info')); }
    catch (e) {
      if (e.status === 401) sessionKey = '';
      setInfo(null);
      toast.error(e.message, { title: 'Cập nhật hệ thống' });
    } finally { setLoading(false); }
  };

  // Mở màn: hỏi server cách xác thực đang bật.
  //   AdminLogin = true  -> dùng TokenKey phiên đăng nhập (tài khoản Is_Admin = 1) – KHÔNG hỏi khoá
  //   ngược lại / bị từ chối -> màn nhập khoá như cũ
  useEffect(() => {
    if (!open) return;
    sessionToken = user?.TokenKey || '';
    (async () => {
      let m = null;
      try { const r = await fetch(`${BASE}/mode`); if (r.ok) m = await r.json(); } catch { /* API cũ chưa có /mode */ }
      setMode(m);
      if (sessionKey || m?.adminLogin) await load();
      setChecking(false);
    })();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const unlock = (e) => {
    e?.preventDefault();
    if (!key.trim()) { toast.warning('Nhập khoá cập nhật (Deploy:Key cấu hình trên server).'); return; }
    sessionKey = key.trim();
    load();
  };

  const pick = (f) => {
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) { toast.warning('Chọn file .zip (gói cập nhật).'); return; }
    setFile(f);
  };

  const deploy = async () => {
    if (!file) { toast.warning('Chọn gói cập nhật (.zip) trước.'); return; }
    const t = TARGETS.find((x) => x.key === target);
    const ok = await msgbox.yesNo(`Cập nhật ${t.text} bằng gói "${file.name}"?`, {
      title: 'Cập nhật hệ thống',
      detail: target === 'api' ? 'API sẽ tự khởi động lại (vài giây) – người đang dùng có thể bị gián đoạn ngắn.' : 'Người đang mở web sẽ được nhắc tải lại trang để dùng bản mới.',
      yesText: 'Cập nhật', noText: 'Huỷ',
    });
    if (!ok) return;
    const prevStarted = info?.api?.startedAt;
    try {
      setProgress(0);
      const rec = await upload(target, file, { by: user?.User_name || '', note }, setProgress);
      if (!rec.files) {
        toast.info('Gói cập nhật giống hệt bản đang chạy – không có file nào thay đổi.', { title: 'Cập nhật hệ thống' });
      } else if (target === 'api') {
        setProgress('restart');
        const after = await waitApiRestart(prevStarted);
        if (after) { setInfo(after); toast.success(`Đã cập nhật API (${rec.files} file) và khởi động lại.`, { title: 'Cập nhật hệ thống' }); }
        else toast.warning('Đã chép file nhưng chưa thấy API khởi động lại – kiểm tra trên server.', { title: 'Cập nhật hệ thống' });
      } else {
        toast.success(`Đã cập nhật giao diện web (${rec.files} file).`, {
          title: 'Cập nhật hệ thống', duration: 0, action: { text: 'Tải lại trang', onClick: () => window.location.reload() },
        });
      }
      setFile(null); setNote('');
      if (target !== 'api' || !rec.files) await load();
    } catch (e) {
      toast.error(e.message, { title: 'Cập nhật thất bại' });
    } finally { setProgress(null); }
  };

  const rollback = async (rec) => {
    const ok = await msgbox.yesNo(`Quay lại trạng thái trước lượt cập nhật ${rec.target === 'api' ? 'API' : 'giao diện web'} lúc ${fmt(rec.at)}?`, {
      title: 'Quay lại bản trước', danger: true, yesText: 'Quay lại', noText: 'Huỷ',
      detail: `${rec.added?.length || 0} file thêm mới sẽ bị xoá, ${rec.replaced?.length || 0} file được khôi phục bản cũ.`,
    });
    if (!ok) return;
    const prevStarted = info?.api?.startedAt;
    try {
      setProgress('restart');
      await call(`/rollback/${encodeURIComponent(rec.id)}?by=${encodeURIComponent(user?.User_name || '')}`, { method: 'POST' });
      if (rec.target === 'api') await waitApiRestart(prevStarted);
      toast.success('Đã quay lại bản trước.', { title: 'Cập nhật hệ thống' });
      await load();
    } catch (e) {
      toast.error(e.message, { title: 'Quay lại thất bại' });
    } finally { setProgress(null); }
  };

  /** Đặt 1 bản web đã lưu làm bản chạy chính */
  const activate = async (rel) => {
    const ok = await msgbox.yesNo(`Đặt bản giao diện web ${formatBuild(rel.version) || ''} (lưu lúc ${fmt(rel.at)}) làm bản chạy chính?`, {
      title: 'Đổi bản chạy chính', yesText: 'Đặt làm bản chính', noText: 'Huỷ',
      detail: 'Toàn bộ file của bản này được chép lại vào thư mục web. Người đang mở web sẽ được nhắc tải lại trang.',
    });
    if (!ok) return;
    try {
      setProgress('restart');
      await call(`/web/activate/${encodeURIComponent(rel.id)}?by=${encodeURIComponent(user?.User_name || '')}`, { method: 'POST' });
      toast.success('Đã đổi bản chạy chính của giao diện web.', {
        title: 'Cập nhật hệ thống', duration: 0, action: { text: 'Tải lại trang', onClick: () => window.location.reload() },
      });
      await load();
    } catch (e) {
      toast.error(e.message, { title: 'Đổi bản thất bại' });
    } finally { setProgress(null); }
  };

  /** Xoá 1 bản web đã lưu (hỏi chắc chắn trước) */
  const removeRelease = async (rel) => {
    const ok = await msgbox.yesNo(`Bạn có chắc chắn muốn xoá bản giao diện web ${formatBuild(rel.version) || ''} (lưu lúc ${fmt(rel.at)})?`, {
      title: 'Xoá bản cập nhật', danger: true, yesText: 'Xoá', noText: 'Huỷ',
      detail: 'Xoá xong không đặt bản này làm bản chính được nữa. Bản đang chạy trên server không bị ảnh hưởng.',
    });
    if (!ok) return;
    try {
      setProgress('restart');
      await call(`/web/release/${encodeURIComponent(rel.id)}/delete?by=${encodeURIComponent(user?.User_name || '')}`, { method: 'POST' });
      toast.success('Đã xoá bản cập nhật.', { title: 'Cập nhật hệ thống' });
      await load();
    } catch (e) {
      toast.error(e.message, { title: 'Xoá bản thất bại' });
    } finally { setProgress(null); }
  };

  // Tab dưới: 'rel' các bản giao diện web | 'hist' lịch sử cập nhật (chưa cấu hình WebPath -> chỉ có lịch sử)
  const curTab = info?.web ? tab : 'hist';

  // lượt cập nhật mới nhất còn hiệu lực của mỗi loại -> được quay lại
  const latestId = {};
  // (sau lượt đó đã "Đặt làm bản chính" thì không quay lại kiểu này nữa – chọn bản ở danh sách bản web)
  for (const r of info?.history || []) {
    if (r.target in latestId) continue;
    if (r.kind === 'activate') latestId[r.target] = null;
    else if (r.kind === 'deploy' && !r.rolledBack) latestId[r.target] = r.id;
  }

  return (
    <CyberPopup open={open} onClose={busy ? undefined : onClose} title="Cập nhật hệ thống" width="80%" height="92vh">
      {checking ? (
        <div className="dp__checking"><span className="mn-open__spin" /> <p>Đang kiểm tra quyền cập nhật...</p></div>
      ) : !info ? (
        <form className="dp__unlock" onSubmit={unlock}>
          <Icon name="lock" size={30} />
          {mode?.adminLogin && <p className="dp__warn">Tài khoản này không được cập nhật bằng quyền quản trị (xem thông báo) – có thể dùng khoá cập nhật.</p>}
          <p>Nhập <b>khoá cập nhật</b> (mục <code>Deploy:Key</code> cấu hình trên server) để tiếp tục.</p>
          <input className="cy-input" type="password" autoFocus value={key} onChange={(e) => setKey(e.target.value)} placeholder="Khoá cập nhật" autoComplete="off" />
          <button type="submit" className="cy-btn cy-btn--primary" disabled={loading}>{loading ? 'Đang kiểm tra...' : 'Mở'}</button>
        </form>
      ) : (
        <div className="dp">
          <p className="hint dp__who">
            <Icon name={info.user ? 'user' : 'lock'} size={14} />
            {info.user ? <>Xác thực bằng tài khoản quản trị <b>{info.user}</b> (Is_Admin = 1)</> : 'Xác thực bằng khoá cập nhật'}
          </p>
          <div className="dp__cards">
            <div className="dp__card">
              <h4><Icon name="dashboard" size={16} /> Giao diện web</h4>
              {info.web ? (
                <>
                  <p><span>Trên server</span><b>{formatBuild(info.web.version)}</b></p>
                  <p><span>Đang mở</span><b>{APP_BUILD.id === 'dev' ? 'bản dev (npm run dev)' : formatBuild(APP_BUILD)}</b></p>
                  <p><span>Thư mục</span><code>{info.web.path}</code></p>
                </>
              ) : <p className="dp__warn">Chưa cấu hình <code>Deploy:WebPath</code> trên server – chưa cập nhật giao diện được.</p>}
            </div>
            <div className="dp__card">
              <h4><Icon name="database" size={16} /> API</h4>
              <p><span>Bản build</span><b>{fmt(info.api.builtAt)}</b></p>
              <p><span>Chạy từ</span><b>{fmt(info.api.startedAt)}</b></p>
              <p><span>Thư mục</span><code>{info.api.path}</code></p>
            </div>
          </div>

          <div className="dp__up">
            <div className="dp__targets" role="radiogroup">
              {TARGETS.map((t) => (
                <button key={t.key} type="button" role="radio" aria-checked={target === t.key} className={target === t.key ? 'is-on' : ''}
                  disabled={busy} onClick={() => setTarget(t.key)}>{t.text}</button>
              ))}
            </div>
            <div className={`dp__drop ${drag ? 'is-drag' : ''} ${file ? 'has-file' : ''}`}
              onClick={() => !busy && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) pick(e.dataTransfer.files?.[0]); }}>
              <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
              <Icon name={file ? 'file' : 'folder'} size={26} />
              {file ? <span><b>{file.name}</b> · {formatSize(file.size)}</span>
                : <span>Kéo thả gói <b>.zip</b> vào đây hoặc bấm để chọn – {TARGETS.find((t) => t.key === target).hint}</span>}
            </div>
            <div className="dp__row">
              <input className="cy-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (vd: sửa lỗi in phiếu)" disabled={busy} />
              <button type="button" className="cy-btn cy-btn--primary" disabled={!file || busy} onClick={deploy}>
                {progress === 'restart' ? 'Đang khởi động lại...' : typeof progress === 'number' ? `Đang tải lên ${progress}%` : 'Cập nhật'}
              </button>
            </div>
            {typeof progress === 'number' && <div className="dp__bar"><i style={{ width: `${progress}%` }} /></div>}
            {progress === 'restart' && <div className="dp__bar is-indeterminate"><i /></div>}
            <p className="hint">Nhanh hơn: chạy <code>npm run deploy</code> (giao diện) hoặc <code>npm run deploy -- api</code> ở máy dev – tự build và đẩy lên (scripts/deploy.mjs).</p>
          </div>

          {/* 2 tab: Các bản giao diện web | Lịch sử cập nhật – bảng cuộn bên trong, cả popup không cuộn */}
          <div className="dp__tabs">
            {/* cùng kiểu nút chọn "Giao diện web / API (máy chủ)" ở trên (.dp__targets) */}
            <div className="dp__targets" role="tablist">
              {info.web && (
                <button type="button" role="tab" aria-selected={curTab === 'rel'} className={curTab === 'rel' ? 'is-on' : ''} onClick={() => setTab('rel')}>
                  Các bản giao diện web <span className="dp__count">{info.web.releases?.length || 0}</span>
                </button>
              )}
              <button type="button" role="tab" aria-selected={curTab === 'hist'} className={curTab === 'hist' ? 'is-on' : ''} onClick={() => setTab('hist')}>
                Lịch sử cập nhật <span className="dp__count">{info.history?.length || 0}</span>
              </button>
            </div>
            {curTab === 'rel' && <span className="hint dp__tabs-hint">Mỗi lần cập nhật tự lưu thành 1 bản</span>}
          </div>

          <div className="dp__pane" role="tabpanel" key={curTab}>
            {curTab === 'rel' ? (
              !info.web.releases?.length ? (
                <p className="hint">Chưa có bản nào – bản đang chạy được tự lưu khi API khởi động lại hoặc ở lần cập nhật web tới.</p>
              ) : (
                <div className="dp__hist dp__rel">
                  <table>
                    <thead><tr><th>Phiên bản</th><th>Lưu lúc</th><th>Người</th><th>Ghi chú</th><th>Dung lượng</th><th /></tr></thead>
                    <tbody>
                      {info.web.releases.map((r) => (
                        <tr key={r.id} className={r.isCurrent ? 'is-current' : ''}>
                          <td><b>{formatBuild(r.version) || '—'}</b></td>
                          <td>{fmt(r.at)}</td>
                          <td>{r.by || '—'}</td>
                          <td className="dp__note">{r.source === 'snapshot' && <em className="dp__tag">bản lưu</em>} {r.note || ''}</td>
                          <td>{formatSize(r.size)}</td>
                          <td className="dp__act-cell">{r.isCurrent
                            ? <span className="dp__live"><Icon name="tick" size={12} strokeWidth={2.4} /> Đang chạy</span>
                            : (
                              <span className="dp__acts">
                                <button type="button" className="cy-btn cy-btn--primary dp__back" disabled={busy} onClick={() => activate(r)}>Đặt làm bản chính</button>
                                <button type="button" className="cy-btn cy-btn--danger dp__back dp__del" disabled={busy} onClick={() => removeRelease(r)} title="Xoá bản này">
                                  <Icon name="trash" size={13} /> Xoá
                                </button>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : !info.history?.length ? <p className="hint">Chưa có lượt cập nhật nào.</p> : (
              <div className="dp__hist">
                <table>
                  <thead><tr><th>Thời gian</th><th>Loại</th><th>Người</th><th>Ghi chú</th><th>File</th><th /></tr></thead>
                  <tbody>
                    {info.history.map((r) => (
                      <tr key={r.id} className={r.rolledBack ? 'is-off' : ''}>
                        <td>{fmt(r.at)}</td>
                        <td>{r.kind === 'rollback' ? 'Quay lại · ' : r.kind === 'activate' ? 'Đổi bản chính · ' : ''}{r.target === 'api' ? 'API' : 'Web'}</td>
                        <td>{r.by || '—'}</td>
                        <td className="dp__note">{r.note || ''}{r.rolledBack ? <em> (đã quay lại)</em> : ''}</td>
                        <td>{r.kind === 'rollback' ? `${r.replaced?.length || 0} khôi phục` : `${r.added?.length || 0} mới · ${r.replaced?.length || 0} sửa`}</td>
                        <td className="dp__act-cell">{latestId[r.target] === r.id && (
                          <button type="button" className="cy-btn dp__back" disabled={busy} onClick={() => rollback(r)}>Quay lại</button>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </CyberPopup>
  );
}
