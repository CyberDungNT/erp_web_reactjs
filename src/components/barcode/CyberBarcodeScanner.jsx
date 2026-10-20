import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/components/cyber';
import Icon from '@/components/icons/Icon';
import { ALL_FORMATS, FORMAT_NAMES, beep, decodeCanvas, decodeImageFile, preloadBarcode } from './barcodeReader';
import './barcode.css';

/**
 * KHUNG QUÉT QR CODE / MÃ VẠCH – từ CAMERA hoặc từ HÌNH ẢNH.
 *
 *   <CyberBarcodeScanner onDetect={(r) => console.log(r.text, r.format)} />
 *   r = { text, format ('qr_code' | 'ean_13' | 'code_128'...), formatName ('QR Code'...), source ('camera' | 'image'), image (dataURL), at }
 *
 * Props:
 *   mode        'camera' | 'image'  chế độ mở lên (mặc định 'camera'); người dùng đổi được bằng 2 nút trên đầu
 *   continuous  true = quét liên tục (mặc định); false = đọc được 1 mã thì dừng camera (vd ô nhập quét 1 lần)
 *   dedupeMs    cùng 1 mã trong khoảng này chỉ báo 1 lần (mặc định 2500)
 *   formats     giới hạn định dạng (mặc định tất cả – FORMAT_NAMES)
 *   sound       tiếng bíp + rung khi đọc được (mặc định true)
 *   autoStart   tự bật camera khi mở (mặc định true)
 *   height      chiều cao khung (mặc định 340)
 * Camera: chọn camera (ưu tiên camera sau), đèn flash nếu máy hỗ trợ. Camera chỉ dùng được trên https hoặc localhost.
 * Ảnh: chọn file, kéo thả, hoặc dán (Ctrl+V) ảnh chụp màn hình – thử kỹ (xoay, đảo màu, nhiều cỡ).
 * Tự tắt camera khi rời màn / đóng popup. Lỗi báo bằng toast.
 */
export default function CyberBarcodeScanner({
  mode: initialMode = 'camera', continuous = true, dedupeMs = 2500, formats = ALL_FORMATS, sound = true,
  autoStart = true, height = 340, onDetect, className = '',
}) {
  const [mode, setMode] = useState(initialMode);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [hit, setHit] = useState(null);         // kết quả vừa đọc (khung xanh + nhãn)
  const [imageInfo, setImageInfo] = useState(null); // { url, result, busy }
  const [drag, setDrag] = useState(false);

  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(0);
  const lastRef = useRef({ text: '', at: 0 });
  const busyRef = useRef(false);
  const fileRef = useRef(null);
  const cbRef = useRef(onDetect);
  cbRef.current = onDetect;

  useEffect(() => { preloadBarcode(formats).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Báo kết quả (chống lặp cùng mã trong dedupeMs) */
  const report = useCallback((r, source, image) => {
    const now = Date.now();
    if (source === 'camera' && r.text === lastRef.current.text && now - lastRef.current.at < dedupeMs) return false;
    lastRef.current = { text: r.text, at: now };
    if (sound) beep();
    const res = { ...r, formatName: FORMAT_NAMES[r.format] || r.format, source, image, at: new Date() };
    cbRef.current?.(res);
    return true;
  }, [dedupeMs, sound]);

  // ===================== Camera =====================
  const stopCamera = useCallback(() => {
    clearTimeout(loopRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
    setTorch({ supported: false, on: false });
  }, []);

  const startCamera = useCallback(async (id = deviceId) => {
    if (!window.isSecureContext) return toast.error('Camera chỉ dùng được khi mở web bằng https (hoặc localhost).', { title: 'Quét mã' });
    if (!navigator.mediaDevices?.getUserMedia) return toast.error('Trình duyệt này không hỗ trợ camera.', { title: 'Quét mã' });
    stopCamera();
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: id ? { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const v = videoRef.current;
      v.srcObject = stream;
      await v.play().catch(() => {});
      setRunning(true);
      // danh sách camera (sau khi được cấp quyền mới có tên)
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      setCameras(devs);
      const track = stream.getVideoTracks()[0];
      setDeviceId(track.getSettings?.().deviceId || id || '');
      setTorch({ supported: !!track.getCapabilities?.().torch, on: false });
    } catch (err) {
      const msg = err?.name === 'NotAllowedError' ? 'Chưa cho phép dùng camera – bấm biểu tượng ổ khoá trên thanh địa chỉ để cho phép.'
        : err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError' ? 'Không tìm thấy camera trên máy.'
          : err?.name === 'NotReadableError' ? 'Camera đang được ứng dụng khác dùng.'
            : `Không mở được camera: ${err?.message || err}`;
      toast.error(msg, { title: 'Quét mã' });
    } finally { setStarting(false); }
  }, [deviceId, stopCamera]);

  // vòng đọc khung hình (~8 lần/giây); khung đang ẩn (tab khác) -> chờ
  useEffect(() => {
    if (!running) return undefined;
    const canvas = document.createElement('canvas');
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      const v = videoRef.current;
      const visible = rootRef.current?.offsetParent && !document.hidden;
      if (v && visible && v.readyState >= 2 && !busyRef.current) {
        busyRef.current = true;
        try {
          canvas.width = v.videoWidth; canvas.height = v.videoHeight;
          canvas.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, 0);
          const r = await decodeCanvas(canvas, { formats });
          if (r && !stopped) {
            const shot = canvas.toDataURL('image/jpeg', 0.7);
            if (report(r, 'camera', shot)) {
              setHit({ ...r, w: canvas.width, h: canvas.height, key: Date.now() });
              if (!continuous) { stopped = true; stopCamera(); return; }
            }
          }
        } catch { /* khung lỗi -> bỏ qua */ } finally { busyRef.current = false; }
      }
      loopRef.current = setTimeout(tick, 120);
    };
    tick();
    return () => { stopped = true; clearTimeout(loopRef.current); };
  }, [running, continuous, formats, report, stopCamera]);

  // tự bật camera khi mở ở chế độ camera; đổi chế độ / rời màn -> tắt
  useEffect(() => {
    if (mode === 'camera' && autoStart) startCamera();
    else stopCamera();
    return stopCamera;
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // khung xanh quanh mã vừa đọc: tự tắt sau 1.2s
  useEffect(() => {
    if (!hit) return undefined;
    const t = setTimeout(() => setHit(null), 1200);
    return () => clearTimeout(t);
  }, [hit]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torch.on }] }); setTorch((t) => ({ ...t, on: !t.on })); }
    catch { toast.warning('Camera này không bật được đèn.'); }
  };

  // ===================== Ảnh =====================
  const readImage = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.warning('Chọn file ảnh (jpg, png, webp...).');
    const url = URL.createObjectURL(file);
    setImageInfo((old) => { if (old?.url) URL.revokeObjectURL(old.url); return { url, busy: true, result: null }; });
    try {
      const r = await decodeImageFile(file, { formats });
      setImageInfo((s) => (s?.url === url ? { ...s, busy: false, result: r || false } : s));
      if (r) {
        const img = new Image(); img.src = url; await img.decode().catch(() => {});
        const { canvas } = (() => { const c = document.createElement('canvas'); const k = Math.min(1, 480 / Math.max(img.width, img.height)); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return { canvas: c }; })();
        report(r, 'image', canvas.toDataURL('image/jpeg', 0.8));
      } else {
        toast.warning('Không tìm thấy QR code / mã vạch trong ảnh. Thử ảnh rõ hơn, chụp thẳng và đủ sáng.', { title: 'Đọc mã từ ảnh' });
      }
    } catch (err) {
      setImageInfo((s) => (s?.url === url ? { ...s, busy: false, result: false } : s));
      toast.error(err?.message || String(err), { title: 'Đọc mã từ ảnh' });
    }
  }, [formats, report]);

  useEffect(() => () => { if (imageInfo?.url) URL.revokeObjectURL(imageInfo.url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dán ảnh (Ctrl+V) khi khung đang hiện
  useEffect(() => {
    const onPaste = (e) => {
      if (!rootRef.current?.offsetParent) return;
      const img = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
      if (!img) return;
      e.preventDefault();
      setMode('image');
      readImage(img);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [readImage]);

  // khung xanh quanh mã vừa đọc: toạ độ khung hình -> toạ độ trên màn (video object-fit: cover = phóng đều rồi cắt 2 bên)
  const hitBox = (() => {
    const box = videoRef.current?.parentElement;
    if (!hit?.points?.length || !box) return null;
    const cw = box.clientWidth, ch = box.clientHeight;
    const s = Math.max(cw / hit.w, ch / hit.h);
    const ox = (cw - hit.w * s) / 2, oy = (ch - hit.h * s) / 2;
    const xs = hit.points.map((p) => p.x * s + ox), ys = hit.points.map((p) => p.y * s + oy);
    let l = Math.min(...xs), r = Math.max(...xs), t = Math.min(...ys), b = Math.max(...ys);
    // QR / DataMatrix / Aztec: điểm ZXing là TÂM ô định vị -> nới ra ~ nửa ô định vị; mã vạch 1D: điểm nằm trên 1 đường -> cho cao lên
    const is2d = /qr|matrix|aztec|pdf/.test(hit.format);
    const padX = is2d ? (r - l) * 0.16 : 10;
    const padY = is2d ? (b - t) * 0.16 : Math.max(24, (r - l) * 0.18);
    l -= padX; r += padX; t -= padY; b += padY;
    return { left: Math.max(0, l), top: Math.max(0, t), width: Math.min(cw, r) - Math.max(0, l), height: Math.min(ch, b) - Math.max(0, t) };
  })();

  return (
    <div ref={rootRef} className={`bc ${className}`}>
      <div className="bc__head">
        <div className="bc__modes" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'camera'} className={mode === 'camera' ? 'is-on' : ''} onClick={() => setMode('camera')}>
            <Icon name="camera" size={15} /> Camera
          </button>
          <button type="button" role="tab" aria-selected={mode === 'image'} className={mode === 'image' ? 'is-on' : ''} onClick={() => setMode('image')}>
            <Icon name="image" size={15} /> Hình ảnh
          </button>
        </div>
        {mode === 'camera' && (
          <div className="bc__tools">
            {cameras.length > 1 && (
              <select className="cy-input bc__cam" value={deviceId} onChange={(e) => { setDeviceId(e.target.value); startCamera(e.target.value); }} title="Chọn camera">
                {cameras.map((c, i) => <option key={c.deviceId || i} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>)}
              </select>
            )}
            {torch.supported && (
              <button type="button" className={`cy-btn bc__btn ${torch.on ? 'is-on' : ''}`} onClick={toggleTorch} title="Đèn flash">
                <Icon name="sun" size={15} /> {torch.on ? 'Tắt đèn' : 'Bật đèn'}
              </button>
            )}
            <button type="button" className="cy-btn bc__btn" disabled={starting} onClick={() => (running ? stopCamera() : startCamera())}>
              <Icon name={running ? 'close' : 'camera'} size={15} /> {starting ? 'Đang mở...' : running ? 'Tắt camera' : 'Bật camera'}
            </button>
          </div>
        )}
      </div>

      {mode === 'camera' ? (
        <div className={`bc__view ${running ? 'is-running' : ''}`} style={{ height }}>
          <video ref={videoRef} className="bc__video" muted playsInline autoPlay />
          {running && (
            <div className="bc__guide" aria-hidden="true">
              <span className="bc__corner bc__corner--tl" /><span className="bc__corner bc__corner--tr" />
              <span className="bc__corner bc__corner--bl" /><span className="bc__corner bc__corner--br" />
              <span className="bc__laser" />
            </div>
          )}
          {hitBox && <span key={hit.key} className="bc__hit" style={hitBox} />}
          {hit && <div key={`t${hit.key}`} className="bc__toast"><Icon name="tick" size={14} strokeWidth={2.4} /> {FORMAT_NAMES[hit.format] || hit.format}: <b>{hit.text}</b></div>}
          {!running && (
            <div className="bc__idle">
              <Icon name="camera" size={34} />
              <p>{starting ? 'Đang mở camera...' : 'Camera đang tắt'}</p>
              {!starting && <button type="button" className="cy-btn cy-btn--primary" onClick={() => startCamera()}><Icon name="camera" size={15} /> Bật camera để quét</button>}
            </div>
          )}
          {running && <p className="bc__tip">Đưa QR code / mã vạch vào giữa khung</p>}
        </div>
      ) : (
        <div className={`bc__drop ${drag ? 'is-drag' : ''}`} style={{ height }}
          onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); readImage([...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'))); }}>
          {imageInfo?.url ? (
            <>
              <img className="bc__img" src={imageInfo.url} alt="Ảnh cần đọc mã" />
              <div className={`bc__imgres ${imageInfo.busy ? '' : imageInfo.result ? 'is-ok' : 'is-fail'}`}>
                {imageInfo.busy ? <><span className="cy-lookup__spin" /> Đang đọc mã...</>
                  : imageInfo.result ? <><Icon name="tick" size={14} strokeWidth={2.4} /> {FORMAT_NAMES[imageInfo.result.format] || imageInfo.result.format}: <b>{imageInfo.result.text}</b></>
                    : <><Icon name="warning" size={14} /> Không tìm thấy mã trong ảnh</>}
              </div>
            </>
          ) : (
            <div className="bc__idle">
              <Icon name="image" size={34} />
              <p>Bấm để chọn ảnh, kéo thả ảnh vào đây<br />hoặc dán ảnh (Ctrl+V)</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { readImage(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      )}
    </div>
  );
}
