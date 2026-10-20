/**
 * ĐỌC QR CODE / MÃ VẠCH (chạy trên trình duyệt, không cần máy chủ)
 *
 *   import { decodeCanvas, decodeImageFile } from '@/components/barcode/barcodeReader';
 *   const r = await decodeImageFile(file);   // r = { text, format, points } | null (không thấy mã)
 *   const r = await decodeCanvas(canvas);    // khung hình camera đã vẽ lên canvas
 *
 * Cách đọc: trình duyệt có sẵn BarcodeDetector (Chrome Android / macOS / ChromeOS) -> dùng (nhanh);
 *           không có (Chrome / Edge trên Windows) -> thư viện ZXing (@zxing/library, nạp khi cần lần đầu).
 * Định dạng: QR, Code 128 / 39 / 93, EAN-13 / 8, UPC-A / E, ITF, Codabar, DataMatrix, PDF417, Aztec.
 */

/** Tên định dạng (hiển thị) – khoá theo tên của BarcodeDetector */
export const FORMAT_NAMES = {
  qr_code: 'QR Code', code_128: 'Code 128', code_39: 'Code 39', code_93: 'Code 93', ean_13: 'EAN-13', ean_8: 'EAN-8',
  upc_a: 'UPC-A', upc_e: 'UPC-E', itf: 'ITF', codabar: 'Codabar', data_matrix: 'DataMatrix', pdf417: 'PDF417', aztec: 'Aztec',
};
export const ALL_FORMATS = Object.keys(FORMAT_NAMES);

// tên ZXing -> tên chung (BarcodeDetector)
const ZX_TO_STD = {
  QR_CODE: 'qr_code', CODE_128: 'code_128', CODE_39: 'code_39', CODE_93: 'code_93', EAN_13: 'ean_13', EAN_8: 'ean_8',
  UPC_A: 'upc_a', UPC_E: 'upc_e', ITF: 'itf', CODABAR: 'codabar', DATA_MATRIX: 'data_matrix', PDF_417: 'pdf417', AZTEC: 'aztec',
};

// ----- Bộ đọc có sẵn của trình duyệt -----
let nativePromise = null;
function getNative(formats) {
  if (!('BarcodeDetector' in window)) return Promise.resolve(null);
  if (!nativePromise) {
    nativePromise = window.BarcodeDetector.getSupportedFormats()
      .then((sup) => {
        const use = formats.filter((f) => sup.includes(f));
        return use.length ? new window.BarcodeDetector({ formats: use }) : null;
      })
      .catch(() => null);
  }
  return nativePromise;
}

// ----- ZXing (nạp khi cần) -----
let zxPromise = null;
function getZxing(formats) {
  if (!zxPromise) {
    zxPromise = import('@zxing/library').then((ZX) => {
      const hints = new Map();
      const wanted = Object.entries(ZX_TO_STD).filter(([, std]) => formats.includes(std)).map(([zx]) => ZX.BarcodeFormat[zx]);
      hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, wanted);
      hints.set(ZX.DecodeHintType.TRY_HARDER, true);
      const reader = new ZX.MultiFormatReader();
      reader.setHints(hints);
      return { ZX, reader };
    }).catch((err) => { zxPromise = null; throw err; });
  }
  return zxPromise;
}

/** Nạp sẵn bộ đọc (gọi khi mở màn quét để lần đọc đầu không phải chờ) */
export const preloadBarcode = (formats = ALL_FORMATS) => Promise.all([getNative(formats), getZxing(formats)]).then(() => true);

/** Ảnh xám (Uint8ClampedArray) từ canvas */
function luminance(canvas) {
  const { width: w, height: h } = canvas;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const lum = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  return lum;
}

function zxDecode({ ZX, reader }, canvas, invert = false) {
  let lum = luminance(canvas);
  if (invert) lum = lum.map((v) => 255 - v); // mã sáng trên nền tối
  const src = new ZX.RGBLuminanceSource(lum, canvas.width, canvas.height);
  const bitmap = new ZX.BinaryBitmap(new ZX.HybridBinarizer(src));
  try {
    const r = reader.decodeWithState(bitmap);
    return {
      text: r.getText(),
      format: ZX_TO_STD[ZX.BarcodeFormat[r.getBarcodeFormat()]] || String(ZX.BarcodeFormat[r.getBarcodeFormat()]).toLowerCase(),
      points: (r.getResultPoints() || []).map((p) => ({ x: p.getX(), y: p.getY() })),
    };
  } catch {
    return null; // không thấy mã (NotFound / Checksum / Format)
  } finally {
    reader.reset();
  }
}

/** Canvas thu nhỏ (giữ tỉ lệ) nếu lớn hơn max cạnh dài */
function scaled(src, max) {
  const w = src.width || src.naturalWidth || src.videoWidth, h = src.height || src.naturalHeight || src.videoHeight;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d', { willReadFrequently: true }).drawImage(src, 0, 0, c.width, c.height);
  return { canvas: c, k };
}

function rotated90(canvas) {
  const c = document.createElement('canvas');
  c.width = canvas.height; c.height = canvas.width;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.translate(c.width, 0); g.rotate(Math.PI / 2); g.drawImage(canvas, 0, 0);
  return c;
}

/**
 * Đọc 1 khung hình / ảnh (canvas, img, video).
 * @param {{ formats?: string[], thorough?: boolean }} opts thorough = thử thêm: xoay 90°, đảo màu, nhiều cỡ ảnh (dùng cho ảnh tải lên)
 * @returns {Promise<{text, format, points}|null>} points theo toạ độ của nguồn truyền vào
 */
export async function decodeCanvas(source, { formats = ALL_FORMATS, thorough = false } = {}) {
  const native = await getNative(formats);
  if (native) {
    try {
      const found = await native.detect(source);
      if (found?.length) {
        const f = found[0];
        return { text: f.rawValue, format: f.format, points: (f.cornerPoints || []).map((p) => ({ x: p.x, y: p.y })) };
      }
      if (!thorough) return null;
    } catch { /* lỗi -> thử ZXing */ }
  }
  const zx = await getZxing(formats);
  const sizes = thorough ? [1600, 1000, 640, 2400] : [1280];
  for (const max of sizes) {
    const { canvas, k } = scaled(source, max);
    const tries = thorough ? [[canvas, false], [canvas, true], [rotated90(canvas), false]] : [[canvas, false]];
    for (const [c, inv] of tries) {
      const r = zxDecode(zx, c, inv);
      if (r) return { ...r, points: c === canvas ? r.points.map((p) => ({ x: p.x / k, y: p.y / k })) : [] };
    }
  }
  if (thorough) return decodeTiles(zx, source);
  return null;
}

/**
 * Mã nhỏ nằm 1 góc ảnh lớn (chụp cả tờ phiếu): cắt 5 vùng chồng nhau (4 góc + giữa, mỗi vùng 60% cạnh),
 * phóng vùng lên ~1000px rồi đọc lại (bộ dò của ZXing – nhất là DataMatrix – kém khi mã chiếm phần nhỏ ảnh).
 */
function decodeTiles(zx, source) {
  const W = source.width || source.naturalWidth || source.videoWidth, H = source.height || source.naturalHeight || source.videoHeight;
  const tw = W * 0.6, th = H * 0.6;
  const spots = [[0, 0], [W - tw, 0], [0, H - th], [W - tw, H - th], [(W - tw) / 2, (H - th) / 2]];
  for (const [x, y] of spots) {
    const k = Math.min(3, 1000 / Math.max(tw, th));
    const c = document.createElement('canvas');
    c.width = Math.round(tw * k); c.height = Math.round(th * k);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = k < 1; // phóng to: giữ cạnh sắc (không làm nhoè module của mã)
    g.drawImage(source, x, y, tw, th, 0, 0, c.width, c.height);
    for (const inv of [false, true]) {
      const r = zxDecode(zx, c, inv);
      if (r) return { ...r, points: r.points.map((p) => ({ x: x + p.x / k, y: y + p.y / k })) };
    }
  }
  return null;
}

/** Đọc mã từ file ảnh (chọn file / kéo thả / dán) – thử kỹ (xoay, đảo màu, nhiều cỡ) */
export async function decodeImageFile(file, { formats = ALL_FORMATS } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await decodeCanvas(img, { formats, thorough: true });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Tiếng "bíp" ngắn khi đọc được mã */
let audioCtx = null;
export function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = 1750;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.13);
  } catch { /* không có âm thanh */ }
  navigator.vibrate?.(60);
}
