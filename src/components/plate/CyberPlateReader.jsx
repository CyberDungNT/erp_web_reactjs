import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { toast } from '@/components/cyber';
import { acquirePlateOcr, readPlate } from './plateOcr';
import './plate.css';

/**
 * ĐỌC BIỂN SỐ XE TỪ CAMERA – control dùng chung.
 *
 *   <CyberPlateReader
 *     source={{ type: 'url', url: 'http://192.168.1.20/snapshot.jpg' }}
 *     auto interval={1200}
 *     onRead={(r) => console.log(r.plate, r.confidence, r.snapshot)}
 *   />
 *
 * source (nguồn hình):
 *   { type: 'webcam', deviceId? }                   webcam / camera điện thoại (cần https hoặc localhost)
 *   { type: 'url', url, relay?, refreshMs? }         link camera – TẤT CẢ xử lý trên máy người dùng, không qua backend:
 *        - rtsp://user:pass@ip:554/...               -> qua go2rtc chạy trên CHÍNH MÁY NÀY (relay, mặc định http://localhost:1984)
 *                                                       web tự đăng ký luồng với go2rtc rồi tải ảnh liên tục. Cài go2rtc: tools/go2rtc/README.md
 *        - ảnh chụp  http://ip/snapshot.jpg          -> tải lại mỗi refreshMs (camera phải cho phép CORS)
 *        - MJPEG     http://ip/video.mjpg            -> phát liên tục (camera phải cho phép CORS)
 *        - video     .mp4 / .webm / .m3u8 (Safari)   -> phát video
 *   { type: 'image', src }                           1 ảnh (dataURL / objectURL) – thử nhanh không cần camera
 *
 * Props khác:
 *   auto         tự đọc liên tục (mặc định false – bấm "Đọc biển số")
 *   interval     ms giữa 2 lần đọc tự động (mặc định 1200)
 *   confirm      số lần đọc liên tiếp giống nhau mới tính là kết quả khi tự đọc (mặc định 2 – chống đọc nhầm)
 *   dedupeMs     cùng 1 biển trong khoảng này chỉ gọi onRead 1 lần (mặc định 8000)
 *   minConfidence  bỏ kết quả có độ tin cậy OCR thấp hơn (0..100, mặc định 20 – biển ngắn nên OCR thường chỉ báo ~50% dù đúng; mẫu biển VN đã lọc thêm)
 *   roi          vùng đọc mặc định theo tỉ lệ khung { x, y, w, h } (0..1). Mặc định: TOÀN KHUNG HÌNH (tự tìm vị trí biển số).
 *                Người dùng bấm "Chọn vùng" để khoanh vùng nhỏ (kéo / đổi cỡ), "Toàn khung" để quay lại.
 *   onRead(r)    r = { plate, compact, confidence, raw, snapshot (ảnh cắt đúng biển số, dataURL), frame (ảnh cả khung dataURL), box, at }
 *   onError(msg)
 *
 * ref: readNow() đọc ngay, capture() lấy ảnh khung hình hiện tại (dataURL)
 */
const FULL_ROI = { x: 0, y: 0, w: 1, h: 1 };            // mặc định: đọc cả khung hình
const PICK_ROI = { x: 0.2, y: 0.45, w: 0.6, h: 0.32 };   // vùng gợi ý khi bấm "Chọn vùng"
const isFullRoi = (r) => r.x <= 0.001 && r.y <= 0.001 && r.w >= 0.999 && r.h >= 0.999;
const MIN_ROI = 0.06;
const VIDEO_RE = /\.(mp4|webm|ogv|ogg|m3u8)(\?|#|$)/i;
const MJPEG_RE = /(mjpe?g|video\.cgi|stream|faststream|nphMotionJpeg)/i;

/** go2rtc chạy trên máy người dùng – chuyển rtsp thành ảnh JPEG cho trình duyệt (tools/go2rtc) */
export const DEFAULT_RELAY = 'http://localhost:1984';

// Tên luồng đăng ký với go2rtc: mã băm của link (không lộ mật khẩu camera trong tên)
const streamName = (url) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) { h ^= url.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `erp_${(h >>> 0).toString(36)}`;
};

/** Xác định cách hiển thị nguồn hình */
function resolveSource(source) {
  if (!source) return { kind: 'none' };
  if (source.type === 'webcam') return { kind: 'webcam', deviceId: source.deviceId };
  if (source.type === 'image') return source.src ? { kind: 'still', src: source.src } : { kind: 'none' };
  const url = String(source.url || '').trim();
  if (!url) return { kind: 'none' };
  if (/^rtsp:/i.test(url)) {
    const relay = String(source.relay || DEFAULT_RELAY).trim().replace(/\/+$/, '');
    const name = streamName(url);
    return { kind: 'poll', relay, rtsp: url, name, src: `${relay}/api/frame.jpeg?src=${name}`, refreshMs: source.refreshMs ?? 300 };
  }
  if (VIDEO_RE.test(url)) return { kind: 'video', src: url };
  if (MJPEG_RE.test(url)) return { kind: 'mjpeg', src: url };
  return { kind: 'poll', src: url, refreshMs: source.refreshMs ?? 700 };
}

const withBust = (src) => `${src}${src.includes('?') ? '&' : '?'}_t=${Date.now()}`;

const RELAY_DOWN = (relay) => `Chưa chạy go2rtc trên máy này (${relay}). Chạy tools/go2rtc/start.bat rồi bấm Kết nối lại – xem tools/go2rtc/README.md.`;

/** Đăng ký link rtsp với go2rtc (PUT /api/streams) – lỗi -> Error có câu báo dễ hiểu */
async function registerRelayStream(src) {
  let res;
  try {
    res = await fetch(`${src.relay}/api/streams?name=${src.name}&src=${encodeURIComponent(src.rtsp)}`, { method: 'PUT' });
  } catch {
    throw new Error(RELAY_DOWN(src.relay));
  }
  if (!res.ok) throw new Error(`go2rtc từ chối đăng ký camera (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`);
}

/** Thẻ <img> lỗi không cho biết lý do -> hỏi lại go2rtc để lấy câu báo lỗi */
async function relayErrorDetail(src, url) {
  let res;
  try { res = await fetch(url, { cache: 'no-store' }); } catch { return RELAY_DOWN(src.relay); }
  if (res.ok) return 'Ảnh từ camera không hiển thị được (dữ liệu ảnh lỗi).';
  const text = (await res.text().catch(() => '')).trim();
  // camera nhận đăng nhập nhưng từ chối mở luồng video (bước SETUP) – Hikvision: thường do đã đủ số kết nối xem cùng lúc
  if (/SETUP|453|not enough bandwidth|session/i.test(text)) return 'Camera từ chối mở luồng video (thường do camera đã đủ số người xem cùng lúc: đầu ghi, app điện thoại, go2rtc khác...). Tắt bớt nơi đang xem camera hoặc khởi động lại camera, rồi bấm Kết nối lại.';
  if (/401|unauthori/i.test(text)) return 'Sai tài khoản / mật khẩu camera (camera trả 401). Lưu ý: camera Hikvision khoá tài khoản sau vài lần sai liên tiếp.';
  if (/404|not found/i.test(text) && !/stream/i.test(text)) return 'Không tìm thấy luồng video trên camera (404) – kiểm tra đường dẫn sau cổng, vd /Streaming/Channels/101.';
  if (/timeout|i\/o|refused|unreachable|no route/i.test(text)) return 'Camera không phản hồi – kiểm tra IP, cổng RTSP và mạng giữa máy này với camera.';
  if (/ffmpeg|exec|codecs not matched/i.test(text)) return 'go2rtc thiếu ffmpeg để đổi hình H.265 / H.264 sang ảnh – đặt ffmpeg.exe cạnh go2rtc.exe (tools/go2rtc/README.md).';
  return `go2rtc báo lỗi khi lấy hình camera: ${text.slice(0, 200) || res.status}`;
}

const CyberPlateReader = forwardRef(function CyberPlateReader({
  source, auto = false, interval = 1200, confirm = 2, dedupeMs = 8000, minConfidence = 20,
  roi: initialRoi = FULL_ROI, onRead, onError, className = '',
}, ref) {
  const src = resolveSource(source);
  const srcKey = JSON.stringify(src.kind === 'poll' ? { ...src, refreshMs: undefined } : src);

  const stageRef = useRef(null);
  const mediaRef = useRef(null);
  const [ratio, setRatio] = useState(16 / 9);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [roi, setRoi] = useState(initialRoi);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);     // kết quả gần nhất (kể cả chưa xác nhận)
  const [pollSrc, setPollSrc] = useState('');
  const roiRef = useRef(roi); roiRef.current = roi;
  const streak = useRef({ compact: '', n: 0 });
  const recent = useRef(new Map());
  const cb = useRef({ onRead, onError }); cb.current = { onRead, onError };
  const pollTimer = useRef(0); // hẹn giờ tải ảnh chụp tiếp theo
  // Ảnh chụp tải lại liên tục -> lúc đọc ảnh có thể đang tải dở (khung trống). Giữ bản sao khung hình tải xong gần nhất để đọc.
  const lastFrame = useRef(null);
  const kindRef = useRef(src.kind); kindRef.current = src.kind;

  // Lỗi: báo bằng TOAST (không hiện chữ lỗi trên giao diện). Cùng 1 lỗi lặp lại (tự thử lại mỗi 3s) chỉ báo 1 lần
  // cho tới khi có hình trở lại.
  const lastToast = useRef('');
  const connError = useRef(false); // đang lỗi kết nối camera (chưa có hình)
  const fail = useCallback((msg) => {
    setError(msg);
    if (msg !== lastToast.current) {
      lastToast.current = msg;
      toast.error(msg, { title: 'Camera / đọc biển số' });
    }
    cb.current.onError?.(msg);
  }, []);

  // Tải sẵn bộ nhận dạng khi control xuất hiện
  // Mở màn: nạp sẵn bộ nhận dạng. Đóng màn (đóng tab): trả lại – không còn màn nào dùng thì tắt worker, giải phóng RAM
  useEffect(() => acquirePlateOcr(), []);

  // ----- Đổi nguồn hình -----
  useEffect(() => {
    setReady(false); setError(''); setLast(null); streak.current = { compact: '', n: 0 }; lastFrame.current = null;
    // rtsp qua go2rtc: đăng ký luồng trước (go2rtc chưa chạy -> báo + tự thử lại mỗi 5s, bật go2rtc lên là có hình)
    if (src.relay) {
      let alive = true; let t;
      setPollSrc('');
      const attempt = () => registerRelayStream(src)
        .then(() => { if (alive) setPollSrc(withBust(src.src)); })
        .catch((e) => { if (!alive) return; connError.current = true; fail(e.message); t = setTimeout(attempt, 5000); });
      attempt();
      return () => { alive = false; clearTimeout(t); };
    }
    if (src.kind === 'poll') setPollSrc(withBust(src.src));
    if (src.kind !== 'webcam') return undefined;
    let stream; let alive = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      fail('Trình duyệt không hỗ trợ camera hoặc trang không chạy https (camera chỉ dùng được trên https hoặc localhost).');
      return undefined;
    }
    navigator.mediaDevices.getUserMedia({
      video: src.deviceId ? { deviceId: { exact: src.deviceId }, width: { ideal: 1920 } } : { facingMode: 'environment', width: { ideal: 1920 } },
      audio: false,
    }).then((s) => {
      if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      if (mediaRef.current) { mediaRef.current.srcObject = s; mediaRef.current.play?.().catch(() => {}); }
    }).catch((err) => fail(err?.name === 'NotAllowedError' ? 'Bạn chưa cho phép dùng camera.' : `Không mở được camera: ${err?.message || err}`));
    return () => { alive = false; stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcKey]);

  // Ảnh chụp: tải ảnh mới sau khi ảnh trước hiện xong
  const onMediaLoad = (e) => {
    const el = e.currentTarget;
    const w = el.naturalWidth || el.videoWidth, h = el.naturalHeight || el.videoHeight;
    if (w && h) setRatio(w / h);
    setReady(true); setError('');
    if (connError.current) { connError.current = false; lastToast.current = ''; } // vừa có hình lại sau lỗi -> lỗi sau báo tiếp
    if (src.kind === 'poll') {
      if (w && h) {
        const copy = document.createElement('canvas');
        copy.width = w; copy.height = h;
        copy.getContext('2d').drawImage(el, 0, 0, w, h);
        lastFrame.current = copy;
      }
      clearTimeout(pollTimer.current);
      pollTimer.current = setTimeout(() => setPollSrc(withBust(src.src)), src.refreshMs);
    }
  };
  useEffect(() => () => clearTimeout(pollTimer.current), [srcKey]);

  const onMediaError = async () => {
    connError.current = true;
    if (src.kind === 'poll') {
      fail(src.relay
        ? await relayErrorDetail(src, pollSrc)
        : 'Không tải được ảnh từ camera (sai link, camera tắt, hoặc camera không cho trình duyệt đọc ảnh – CORS). Với camera rtsp hãy dùng link rtsp:// (qua go2rtc).');
      clearTimeout(pollTimer.current);
      // thử lại; go2rtc khởi động lại thì mất luồng đã đăng ký -> đăng ký lại trước
      pollTimer.current = setTimeout(async () => {
        if (src.relay) await registerRelayStream(src).catch(() => {});
        setPollSrc(withBust(src.src));
      }, 3000);
    } else if (src.kind !== 'webcam') {
      fail('Không phát được nguồn hình này trên trình duyệt. Với camera rtsp hãy dùng link rtsp:// (qua go2rtc).');
    }
  };

  // ----- Lấy khung hình -----
  const grabFrame = useCallback(() => {
    if (kindRef.current === 'poll' && lastFrame.current) return lastFrame.current;
    const el = mediaRef.current;
    if (!el) throw new Error('Chưa có hình từ camera.');
    const w = el.naturalWidth || el.videoWidth, h = el.naturalHeight || el.videoHeight;
    if (!w || !h) throw new Error('Camera chưa có hình.');
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(el, 0, 0, w, h);
    return canvas;
  }, []);

  const cropRoi = (frame) => {
    const r = roiRef.current;
    const sx = Math.round(r.x * frame.width), sy = Math.round(r.y * frame.height);
    const sw = Math.max(8, Math.round(r.w * frame.width)), sh = Math.max(8, Math.round(r.h * frame.height));
    const c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    c.getContext('2d').drawImage(frame, sx, sy, sw, sh, 0, 0, sw, sh);
    return c;
  };

  /** Đọc 1 lần. manual = bấm tay (không cần xác nhận nhiều lần) */
  const readOnce = useCallback(async (manual) => {
    let frame;
    try { frame = grabFrame(); } catch (e) { if (manual) fail(e.message); return null; }
    let crop, snapshot;
    try {
      crop = cropRoi(frame);
      snapshot = crop.toDataURL('image/jpeg', 0.85); // cũng để phát hiện ảnh bị chặn đọc (CORS)
    } catch {
      fail('Camera không cho phép trình duyệt đọc ảnh (CORS). Với camera rtsp hãy dùng link rtsp:// (qua go2rtc), hoặc bật CORS trên camera.');
      return null;
    }
    setBusy(true);
    try {
      const r = await readPlate(crop);
      // ảnh lưu: cắt đúng biển số tìm được (đọc toàn khung thì ảnh cả khung biển rất nhỏ, khó nhìn)
      if (r.box) {
        const m = Math.round(r.box.h * 0.3);
        const bx = Math.max(0, r.box.x - m), by = Math.max(0, r.box.y - m);
        const bw = Math.min(crop.width - bx, r.box.w + m * 2), bh = Math.min(crop.height - by, r.box.h + m * 2);
        const pc = document.createElement('canvas');
        pc.width = bw; pc.height = bh;
        pc.getContext('2d').drawImage(crop, bx, by, bw, bh, 0, 0, bw, bh);
        snapshot = pc.toDataURL('image/jpeg', 0.9);
      }
      const res = { ...r, snapshot, at: new Date() };
      setLast(res);
      if (!r.valid || (r.confidence != null && r.confidence < minConfidence)) { streak.current = { compact: '', n: 0 }; return res; }
      // tự đọc: cần `confirm` lần liên tiếp giống nhau
      const s = streak.current;
      s.n = s.compact === r.compact ? s.n + 1 : 1; s.compact = r.compact;
      if (!manual && s.n < confirm) return res;
      // cùng biển trong dedupeMs -> không báo lại
      const now = Date.now();
      const prev = recent.current.get(r.compact);
      if (!manual && prev && now - prev < dedupeMs) return res;
      recent.current.set(r.compact, now);
      cb.current.onRead?.({ ...res, frame: frame.toDataURL('image/jpeg', 0.8), confirmed: true });
      return res;
    } catch (e) {
      fail(`Lỗi nhận dạng: ${e?.message || e}`);
      return null;
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grabFrame, confirm, dedupeMs, minConfidence]);

  // ----- Tự đọc liên tục -----
  useEffect(() => {
    if (!auto || !ready) return undefined;
    let stop = false; let t;
    const loop = async () => {
      if (stop) return;
      if (!document.hidden) await readOnce(false);
      if (!stop) t = setTimeout(loop, interval);
    };
    t = setTimeout(loop, 300);
    return () => { stop = true; clearTimeout(t); };
  }, [auto, ready, interval, readOnce]);

  useImperativeHandle(ref, () => ({
    readNow: () => readOnce(true),
    capture: () => grabFrame().toDataURL('image/jpeg', 0.9),
  }), [readOnce, grabFrame]);

  // ----- Kéo / đổi cỡ vùng đọc -----
  const startDrag = (e, mode) => {
    e.preventDefault(); e.stopPropagation();
    const box = stageRef.current.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, roi: roiRef.current };
    const move = (ev) => {
      const dx = (ev.clientX - start.x) / box.width, dy = (ev.clientY - start.y) / box.height;
      const r = start.roi;
      if (mode === 'move') {
        setRoi({ ...r, x: Math.min(1 - r.w, Math.max(0, r.x + dx)), y: Math.min(1 - r.h, Math.max(0, r.y + dy)) });
      } else {
        setRoi({ ...r, w: Math.min(1 - r.x, Math.max(MIN_ROI, r.w + dx)), h: Math.min(1 - r.y, Math.max(MIN_ROI, r.h + dy)) });
      }
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const media = (() => {
    const common = { ref: mediaRef, className: 'plr__media', onError: onMediaError, crossOrigin: src.kind === 'webcam' ? undefined : 'anonymous' };
    switch (src.kind) {
      case 'webcam': return <video {...common} autoPlay muted playsInline onLoadedMetadata={onMediaLoad} />;
      case 'video': return <video {...common} src={src.src} autoPlay muted playsInline loop onLoadedMetadata={onMediaLoad} />;
      case 'mjpeg': case 'still': return <img {...common} src={src.src} alt="" onLoad={onMediaLoad} draggable={false} />;
      case 'poll': return pollSrc ? <img {...common} src={pollSrc} alt="" onLoad={onMediaLoad} draggable={false} /> : null;
      default: return null;
    }
  })();

  return (
    <div className={`plr ${className}`}>
      <div className="plr__stage" ref={stageRef} style={{ aspectRatio: ratio }}>
        {media}
        {src.kind === 'none' && <div className="plr__empty">Chọn nguồn camera để bắt đầu</div>}
        {src.kind !== 'none' && !ready && (
          <div className="plr__empty">{error ? 'Chưa có hình từ camera – đang thử kết nối lại...' : <><span className="plr__spin" /> Đang kết nối camera...</>}</div>
        )}
        {ready && isFullRoi(roi) && (
          <>
            <span className="plr__full">{busy ? 'Đang đọc...' : 'Đọc toàn khung hình'}</span>
            {busy && <span className="plr__scan plr__scan--full" />}
          </>
        )}
        {ready && !isFullRoi(roi) && (
          <div className="plr__roi" style={{ left: `${roi.x * 100}%`, top: `${roi.y * 100}%`, width: `${roi.w * 100}%`, height: `${roi.h * 100}%` }}
            onPointerDown={(e) => startDrag(e, 'move')} title="Kéo để di chuyển vùng đọc biển số">
            <span className="plr__roi-label">{busy ? 'Đang đọc...' : 'Vùng đọc biển số'}</span>
            {busy && <span className="plr__scan" />}
            <span className="plr__roi-handle" onPointerDown={(e) => startDrag(e, 'resize')} title="Kéo để đổi cỡ" />
          </div>
        )}
        {auto && ready && <span className="plr__live"><i /> Tự đọc</span>}
      </div>
      <div className="plr__bar">
        <div className={`plr__plate ${last?.valid ? 'is-ok' : ''}`}>
          {last?.valid ? last.plate : last ? <small>Chưa nhận ra biển ({last.raw ? `đọc được: ${last.raw.replace(/\s+/g, ' ')}` : 'không có chữ'})</small> : <small>Chưa đọc</small>}
        </div>
        {last?.valid && last.confidence != null && <span className="plr__conf" title="Độ tin cậy">{last.confidence}%</span>}
        <button type="button" className="cy-btn cy-btn--primary" disabled={!ready || busy} onClick={() => readOnce(true)}>
          {busy ? 'Đang đọc...' : 'Đọc biển số'}
        </button>
        {isFullRoi(roi)
          ? <button type="button" className="cy-btn" disabled={!ready} onClick={() => setRoi(isFullRoi(initialRoi) ? PICK_ROI : initialRoi)} title="Khoanh 1 vùng nhỏ để đọc (camera nhìn rộng, nhiều xe)">Chọn vùng</button>
          : <button type="button" className="cy-btn" disabled={!ready} onClick={() => setRoi(FULL_ROI)} title="Đọc toàn bộ khung hình">Toàn khung</button>}
      </div>
    </div>
  );
});

export default CyberPlateReader;

/** Danh sách camera của máy (để chọn webcam). Cần đã cho phép dùng camera 1 lần thì mới có tên */
export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, name: d.label || `Camera ${i + 1}` }));
}
