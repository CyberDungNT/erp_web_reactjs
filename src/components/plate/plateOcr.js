/**
 * NHẬN DẠNG BIỂN SỐ XE (chạy ngay trên trình duyệt – Tesseract.js, không cần máy chủ AI)
 *
 *   import { readPlate, parsePlate } from '@/components/plate/plateOcr';
 *   const r = await readPlate(canvas);   // canvas = vùng ảnh có biển số
 *   r.plate      -> '30A-123.45' (đã chuẩn hoá theo mẫu biển VN) | '' nếu không ra biển hợp lệ
 *   r.valid      -> true nếu khớp mẫu biển VN
 *   r.confidence -> độ tin cậy 0..100 của OCR
 *   r.raw        -> chữ OCR đọc được (chưa sửa)
 *   r.box        -> vị trí biển số tìm được trên ảnh truyền vào { x, y, w, h } (null nếu không định vị được)
 *
 * Các bước: xám -> nhị phân thích ứng -> TỰ ĐỊNH VỊ biển (hàng ký tự cùng cỡ, thẳng hàng; hỗ trợ biển 2 dòng)
 *           -> OCR chỉ vùng biển (chỉ cho chữ in hoa / số / - .) -> sửa lỗi nhầm theo vị trí (O<->0, B<->8...) -> kiểm tra mẫu biển VN.
 *
 * Lần đầu dùng sẽ tải bộ nhận dạng (~ vài MB, từ CDN jsdelivr) rồi trình duyệt tự lưu cache.
 * Muốn chạy không cần internet: chép thư mục worker/core/lang của tesseract.js vào public/ rồi khai báo ở TESS_PATHS.
 */
import { createWorker, PSM, OEM } from 'tesseract.js';

/** Để trống = dùng CDN mặc định của tesseract.js. Chạy offline: { workerPath, corePath, langPath } trỏ vào public/ */
export const TESS_PATHS = {};

let workerPromise = null;
let queue = Promise.resolve(); // 1 worker -> xử lý lần lượt từng ảnh

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng', OEM.LSTM_ONLY, { ...TESS_PATHS });
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHKLMNPRSTUVXYZ0123456789-.',
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // biển 1 hoặc 2 dòng
        preserve_interword_spaces: '0',
      });
      return worker;
    })().catch((err) => { workerPromise = null; throw err; });
  }
  return workerPromise;
}

/** Tải sẵn bộ nhận dạng (gọi khi mở màn để lần đọc đầu nhanh hơn) */
export const preloadPlateOcr = () => getWorker().then(() => true);

/** Giải phóng bộ nhận dạng (thường không cần) */
export async function disposePlateOcr() {
  const w = workerPromise; workerPromise = null;
  if (w) (await w).terminate();
}

// ===================== Xử lý ảnh =====================

/** Ảnh xám (Uint8Array) từ canvas / ảnh, giới hạn kích thước để xử lý nhanh */
function toGray(src) {
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  let scale = Math.min(4, Math.max(1, 240 / sh));     // ảnh nhỏ -> phóng to
  if (sw * scale > 1600) scale = 1600 / sw;            // ảnh lớn (cả khung camera) -> thu nhỏ
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) gray[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  return { gray, w, h, scale };
}

/**
 * Nhị phân THÍCH ỨNG (Bradley): điểm ảnh tối hơn trung bình vùng quanh nó 15% -> mực (1).
 * Khác ngưỡng chung (Otsu): thân xe xám / bóng đổ không bị gộp với chữ.
 * light = true: tìm chữ SÁNG trên nền tối (biển xanh chữ trắng).
 */
function adaptiveBinary(gray, w, h, light) {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      const v = light ? 255 - gray[y * w + x] : gray[y * w + x];
      row += v;
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const half = Math.round(Math.min(120, Math.max(8, Math.max(w, h) / 24)));
  const bin = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half), y1 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half), x1 = Math.min(w - 1, x + half);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[(y1 + 1) * (w + 1) + x1 + 1] - integral[y0 * (w + 1) + x1 + 1]
        - integral[(y1 + 1) * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const v = light ? 255 - gray[y * w + x] : gray[y * w + x];
      if (v * count <= sum * 0.85) bin[y * w + x] = 1;
    }
  }
  return bin;
}

/** Tách các khối mực liền nhau (8 hướng). Trả về nhãn từng điểm ảnh + khung bao từng khối */
function components(bin, w, h) {
  const label = new Int32Array(w * h);
  const comps = [];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < bin.length; start++) {
    if (!bin[start] || label[start]) continue;
    const id = comps.length + 1;
    let sp = 0; stack[sp++] = start; label[start] = id;
    let minx = w, miny = h, maxx = 0, maxy = 0, area = 0;
    while (sp) {
      const p = stack[--sp];
      const x = p % w, y = (p - x) / w;
      area++;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy; if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx; if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (bin[q] && !label[q]) { label[q] = id; stack[sp++] = q; }
        }
      }
    }
    const cw = maxx - minx + 1, ch = maxy - miny + 1;
    comps.push({ id, minx, miny, maxx, maxy, w: cw, h: ch, area, cx: (minx + maxx) / 2, cy: (miny + maxy) / 2 });
  }
  return { label, comps };
}

/**
 * Tìm biển số = 1 hàng (hoặc 2 hàng – biển xe máy) các khối "giống ký tự": cao tương đương, thẳng hàng, sát nhau.
 * @returns {{ chars: object[], box: {x0,y0,x1,y1}, ch: number } | null}
 */
function findPlate(comps, w, h) {
  const chars = comps.filter((c) => c.h >= Math.max(10, h * 0.02) && c.h <= h * 0.95
    && c.w / c.h >= 0.08 && c.w / c.h <= 1.2 && c.area / (c.w * c.h) >= 0.1 && c.area / (c.w * c.h) <= 0.95);
  if (chars.length < 3) return null;

  // các hàng ký tự: từ mỗi ký tự làm gốc, gom ký tự cùng cỡ, cùng dòng, nối liền theo chiều ngang
  const rows = new Map();
  for (const seed of chars) {
    const same = chars.filter((c) => Math.abs(c.h - seed.h) <= seed.h * 0.3 && Math.abs(c.cy - seed.cy) <= seed.h * 0.5)
      .sort((a, b) => a.cx - b.cx);
    let run = []; let found = null;
    for (const c of same) {
      if (run.length && c.minx - run[run.length - 1].maxx > seed.h * 1.6) {
        if (run.includes(seed)) found = run;
        run = [];
      }
      run.push(c);
    }
    if (!found && run.includes(seed)) found = run;
    if (found && found.length >= 3) rows.set(found.map((c) => c.id).join(','), found);
  }
  if (!rows.size) return null;

  const boxOf = (cs) => ({
    x0: Math.min(...cs.map((c) => c.minx)), y0: Math.min(...cs.map((c) => c.miny)),
    x1: Math.max(...cs.map((c) => c.maxx)), y1: Math.max(...cs.map((c) => c.maxy)),
    ch: cs.reduce((s, c) => s + c.h, 0) / cs.length,
  });
  const list = [...rows.values()].map((cs) => ({ cs, ...boxOf(cs) }));
  // hàng tốt nhất: nhiều ký tự nhất (biển VN 4-6 ký tự / dòng), cùng số thì chữ to hơn
  list.sort((a, b) => Math.min(b.cs.length, 9) - Math.min(a.cs.length, 9) || b.ch - a.ch);
  const best = list[0];
  // biển 2 dòng: hàng cùng cỡ chữ, chồng nhau theo chiều ngang, ngay trên / dưới
  let group = best.cs;
  const other = list.find((r) => r !== best && !r.cs.some((c) => best.cs.includes(c))
    && Math.abs(r.ch - best.ch) <= best.ch * 0.3
    && Math.min(r.x1, best.x1) - Math.max(r.x0, best.x0) >= Math.min(r.x1 - r.x0, best.x1 - best.x0) * 0.3
    && (Math.abs(r.y0 - best.y1) <= best.ch * 1.0 || Math.abs(best.y0 - r.y1) <= best.ch * 1.0));
  if (other) group = [...best.cs, ...other.cs];
  const b = boxOf(group);
  return { chars: group, box: b, ch: b.ch, rows: other ? 2 : 1 };
}

/**
 * Làm sạch ảnh trước khi OCR:
 *   xám -> nhị phân thích ứng (thử chữ tối nền sáng VÀ chữ sáng nền tối) -> tìm hàng ký tự (biển số)
 *   -> cắt đúng vùng biển, CHỈ vẽ lại các ký tự (bỏ viền biển, thân xe, nhiễu) thành chữ đen nền trắng, cỡ chữ ~64px.
 * Không tìm thấy hàng ký tự -> trả cả vùng đã nhị phân.
 */
export function preprocess(src) {
  const { gray, w, h, scale } = toGray(src);
  let pick = null;
  for (const light of [false, true]) {
    const bin = adaptiveBinary(gray, w, h, light);
    const { label, comps } = components(bin, w, h);
    const plate = findPlate(comps, w, h);
    const score = plate ? Math.min(plate.chars.length, 12) : 0;
    if (!pick || score > pick.score) pick = { bin, label, comps, plate, score };
  }

  const out = document.createElement('canvas');
  const ctx = out.getContext('2d');
  if (!pick.plate) {
    // không định vị được biển -> dùng cả vùng (chữ đen nền trắng)
    out.width = w; out.height = h;
    const img = ctx.createImageData(w, h);
    for (let j = 0; j < w * h; j++) { const v = pick.bin[j] ? 0 : 255; img.data[j * 4] = img.data[j * 4 + 1] = img.data[j * 4 + 2] = v; img.data[j * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return withPadding(out, Math.round(h * 0.1));
  }

  const { box, ch, chars } = pick.plate;
  const keep = new Set(chars.map((c) => c.id));
  // giữ thêm dấu "-" "." nằm trong vùng biển (nhỏ hơn ký tự) – giúp tách đúng phần đầu / phần số
  for (const c of pick.comps) {
    if (keep.has(c.id)) continue;
    if (c.minx >= box.x0 - ch * 0.2 && c.maxx <= box.x1 + ch * 0.2 && c.miny >= box.y0 - ch * 0.2 && c.maxy <= box.y1 + ch * 0.2
      && c.h < ch * 0.6 && c.w < ch * 1.2 && c.area >= ch * ch * 0.004) keep.add(c.id);
  }
  const m = Math.round(ch * 0.35);
  const x0 = Math.max(0, box.x0 - m), y0 = Math.max(0, box.y0 - m);
  const x1 = Math.min(w - 1, box.x1 + m), y1 = Math.min(h - 1, box.y1 + m);
  const cw = x1 - x0 + 1, chh = y1 - y0 + 1;
  const crop = document.createElement('canvas');
  crop.width = cw; crop.height = chh;
  const cctx = crop.getContext('2d');
  const img = cctx.createImageData(cw, chh);
  for (let y = 0; y < chh; y++) {
    for (let x = 0; x < cw; x++) {
      const v = keep.has(pick.label[(y + y0) * w + x + x0]) ? 0 : 255;
      const k = (y * cw + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
    }
  }
  cctx.putImageData(img, 0, 0);
  // chuẩn cỡ chữ ~64px (Tesseract đọc tốt nhất ở cỡ này)
  const s = Math.min(4, Math.max(0.4, 64 / ch));
  out.width = Math.round(cw * s); out.height = Math.round(chh * s);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(crop, 0, 0, out.width, out.height);
  const result = withPadding(out, Math.round(64 * 0.5));
  // vị trí biển số trên ảnh GỐC (để cắt ảnh màu vùng biển: ảnh lưu lịch sử, ảnh gửi nghiệp vụ)
  result.plateBox = { x: Math.round(x0 / scale), y: Math.round(y0 / scale), w: Math.round(cw / scale), h: Math.round(chh / scale) };
  return result;
}

/** Viền trắng quanh ảnh giúp Tesseract tách chữ ở mép tốt hơn */
function withPadding(canvas, pad) {
  const framed = document.createElement('canvas');
  framed.width = canvas.width + pad * 2; framed.height = canvas.height + pad * 2;
  const ctx = framed.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, framed.width, framed.height);
  ctx.drawImage(canvas, pad, pad);
  return framed;
}

// ===================== Chuẩn hoá biển số VN =====================

const TO_DIGIT = { O: '0', D: '0', Q: '0', U: '0', I: '1', L: '1', T: '1', J: '1', Z: '2', S: '5', B: '8', G: '6', A: '4' };
const TO_LETTER = { 0: 'D', 8: 'B', 5: 'S', 2: 'Z', 6: 'G', 4: 'A', 1: 'T', 7: 'T' };
const digit = (c) => (/[0-9]/.test(c) ? c : TO_DIGIT[c] || null);
const letter = (c) => (/[A-Z]/.test(c) ? c : TO_LETTER[c] || null);

/**
 * Chuẩn hoá chuỗi OCR thành biển số VN.
 *   Ô tô    : 2 số tỉnh + 1-2 chữ seri + 4-5 số   -> 30A-123.45 | 30A-1234 | 51LD-123.45
 *   Xe máy  : 2 số tỉnh + chữ + số seri + 4-5 số  -> 29-B1 123.45 | 59-X3 1234
 * @returns {{ plate: string, valid: boolean, compact: string }}
 */
export function parsePlate(text) {
  const upper = String(text || '').toUpperCase();
  const compact = upper.replace(/[^A-Z0-9]/g, '');
  if (compact.length < 7) return { plate: '', valid: false, compact };
  // vị trí các dấu ngăn cách OCR đọc được (khoảng trắng, xuống dòng, - .) tính theo chuỗi đã bỏ ký tự lạ
  // -> gợi ý chỗ tách "đầu biển | dãy số" (vd '59X3 1234' là xe máy 59-X3, không phải ô tô 59X-312.34)
  const breaks = new Set();
  let pos = 0;
  for (const ch of upper) {
    if (/[A-Z0-9]/.test(ch)) pos++;
    else if (pos > 0) breaks.add(pos);
  }

  // thử từng cách tách: [tỉnh 2][seri 1-3][số 4-5], ưu tiên cách khớp nhiều nhất không phải sửa
  const candidates = [];
  for (let start = 0; start <= Math.min(2, compact.length - 7); start++) {
    const s = compact.slice(start);
    for (const serLen of [1, 2]) {
      for (const tailLen of [5, 4]) {
        for (const serDigit of [false, true]) {
          const need = 2 + serLen + (serDigit ? 1 : 0) + tailLen;
          if (s.length < need) continue;
          const part = s.slice(0, need);
          let fixes = 0;
          const fix = (c, fn) => { const v = fn(c); if (v !== c) fixes++; return v; };
          const prov = [fix(part[0], digit), fix(part[1], digit)];
          const ser = [];
          for (let i = 0; i < serLen; i++) ser.push(fix(part[2 + i], letter));
          if (serDigit) ser.push(fix(part[2 + serLen], digit));
          const tail = [...part.slice(need - tailLen)].map((c) => fix(c, digit));
          if ([...prov, ...ser, ...tail].some((c) => !c)) continue;
          // tỉnh 11..99 (VN không có mã 00-10)
          if (+prov.join('') < 11) continue;
          // điểm (càng thấp càng tốt): số ký tự phải sửa + ký tự thừa; ưu tiên dạng phổ biến (seri 1 chữ, đuôi 5 số)
          // và cách tách trùng dấu ngăn cách OCR đọc được
          const extra = s.length - need + start;
          // xe máy mà số seri phải sửa từ chữ (vd 51LD đọc thành 51-L0) -> khả năng thấp hơn biển seri 2 chữ
          const serDigitFixed = serDigit && !/[0-9]/.test(part[2 + serLen]);
          const score = fixes + extra * 3 + (serLen === 2 ? 1.5 : 0) + (tailLen === 4 ? 1 : 0) + (serDigitFixed ? 1.5 : 0)
            - (breaks.has(start + need - tailLen) ? 2 : 0);
          candidates.push({ prov: prov.join(''), ser: ser.join(''), tail: tail.join(''), score, serDigit });
        }
      }
    }
  }
  if (!candidates.length) return { plate: '', valid: false, compact };
  candidates.sort((a, b) => a.score - b.score || b.tail.length - a.tail.length);
  const c = candidates[0];
  const tail = c.tail.length === 5 ? `${c.tail.slice(0, 3)}.${c.tail.slice(3)}` : c.tail;
  const plate = c.serDigit ? `${c.prov}-${c.ser} ${tail}` : `${c.prov}${c.ser}-${tail}`;
  return { plate, valid: true, compact: `${c.prov}${c.ser}${c.tail}` };
}

// ===================== Đọc =====================

/**
 * Đọc biển số từ 1 canvas / ảnh (đã cắt vùng có biển).
 * @param {HTMLCanvasElement|HTMLImageElement} source
 * @returns {Promise<{plate, valid, compact, raw, confidence, image}>}  image = dataURL ảnh đã làm sạch (để xem / lưu)
 */
export function readPlate(source) {
  const job = queue.then(async () => {
    const worker = await getWorker();
    const clean = preprocess(source);
    const { data } = await worker.recognize(clean);
    const raw = (data.text || '').trim();
    const parsed = parsePlate(raw);
    // Tesseract đôi khi báo độ tin cậy tổng = 0 dù đọc đúng -> lấy trung bình độ tin cậy từng ký tự; vẫn không có -> null (không rõ)
    let confidence = data.confidence || 0;
    if (!confidence) {
      const syms = (data.symbols || []).map((s) => s.confidence).filter((c) => c > 0);
      confidence = syms.length ? syms.reduce((a, b) => a + b, 0) / syms.length : null;
    }
    return { ...parsed, raw, confidence: confidence == null ? null : Math.round(confidence), image: clean.toDataURL('image/png'), box: clean.plateBox || null };
  });
  queue = job.catch(() => {});
  return job;
}
