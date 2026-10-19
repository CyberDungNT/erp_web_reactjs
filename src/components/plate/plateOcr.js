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
 * Các bước: xám -> làm mịn (khử nhiễu hạt) -> nhị phân thích ứng -> TỰ ĐỊNH VỊ biển (hàng ký tự cùng cỡ, thẳng hàng; 1 hoặc 2 dòng)
 *           -> XOAY THẲNG biển nghiêng -> tách từng ký tự
 *   Cách 1 (chính): SO KHỚP MẪU font biển VN (kiểu DIN hẹp – plateGlyphs.js) từng ký tự, mỗi vị trí chỉ xét đúng loại ký tự
 *           (mã tỉnh = số, seri = chữ, dòng dưới = số), bỏ mảnh rác (vạch gạch lát, ký tự vỡ). Không cần OCR -> nhanh.
 *   Cách 2 (dự phòng, khi cách 1 không ra biển hợp lệ): Tesseract OCR chế độ 1 dòng (biển 2 dòng đọc RIÊNG từng dòng).
 *   -> sửa lỗi nhầm theo vị trí (O<->0, B<->8...) + chỉ nhận chữ seri có trên biển VN -> ghép đúng mẫu biển ô tô / xe máy.
 *   r.method = 'glyph' | 'ocr' cho biết cách đã đọc ra kết quả.
 *
 * Lần đầu dùng sẽ tải bộ nhận dạng (~ vài MB, từ CDN jsdelivr) rồi trình duyệt tự lưu cache.
 * Muốn chạy không cần internet: chép thư mục worker/core/lang của tesseract.js vào public/ rồi khai báo ở TESS_PATHS.
 */
import { createWorker, PSM, OEM } from 'tesseract.js';
import { GLYPHS, GLYPH_W, GLYPH_H } from './plateGlyphs';

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
        tessedit_pageseg_mode: PSM.SINGLE_LINE, // mỗi lần đọc đổi lại theo dòng (readPlate -> ocrLine)
        preserve_interword_spaces: '0',
      });
      return worker;
    })().catch((err) => { workerPromise = null; throw err; });
  }
  return workerPromise;
}

/** Tải sẵn bộ nhận dạng (gọi khi mở màn để lần đọc đầu nhanh hơn) */
export const preloadPlateOcr = () => getWorker().then(() => true);

/** Giải phóng bộ nhận dạng: tắt web worker + bộ nhớ WASM (vài chục MB) */
export async function disposePlateOcr() {
  const w = workerPromise; workerPromise = null;
  if (w) { try { (await w).terminate(); } catch { /* worker lỗi lúc tạo – không còn gì để tắt */ } }
}

// ----- Đếm số nơi đang dùng (CyberPlateReader đang mở) – không còn ai dùng thì tự tắt worker -----
let users = 0;
let idleTimer = null;
const IDLE_MS = 3000; // đóng rồi mở lại ngay (chuyển qua lại) không phải nạp lại worker

/** Gọi khi mở màn đọc biển số; trả hàm gọi khi đóng màn. Đóng hết -> sau 3 giây tắt worker giải phóng RAM */
export function acquirePlateOcr() {
  users += 1;
  clearTimeout(idleTimer);
  preloadPlateOcr().catch(() => {});
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users -= 1;
    if (users > 0) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
      if (users > 0) return;
      await queue.catch(() => {}); // chờ ảnh đang đọc dở xong rồi mới tắt
      if (users === 0) disposePlateOcr();
    }, IDLE_MS);
  };
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
  return { gray: smooth(gray, w, h), w, h, scale };
}

/**
 * Làm mịn 3x3 (nhân [1 2 1] theo 2 chiều) – khử nhiễu hạt của camera (ban đêm, nén ảnh) trước khi nhị phân:
 * không làm mịn thì nét chữ bị đục lỗ lấm tấm, ký tự vỡ thành nhiều mảnh -> OCR đọc sai / không ra.
 */
function smooth(src, w, h) {
  const tmp = new Uint16Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      const l = src[r + (x > 0 ? x - 1 : x)], c = src[r + x], rr = src[r + (x < w - 1 ? x + 1 : x)];
      tmp[r + x] = l + 2 * c + rr;
    }
  }
  for (let y = 0; y < h; y++) {
    const up = (y > 0 ? y - 1 : y) * w, r = y * w, dn = (y < h - 1 ? y + 1 : y) * w;
    for (let x = 0; x < w; x++) out[r + x] = (tmp[up + x] + 2 * tmp[r + x] + tmp[dn + x] + 8) >> 4;
  }
  return out;
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
  // từng dòng (trên -> dưới) để OCR riêng: dòng trên = mã tỉnh + seri, dòng dưới = dãy số
  const lines = (other ? [best, other] : [best]).map((r) => ({ cs: r.cs, ...boxOf(r.cs) })).sort((p, q) => p.y0 - q.y0);
  return { chars: group, box: b, ch: b.ch, rows: other ? 2 : 1, lines };
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

  // XOAY THẲNG biển nghiêng (camera đặt lệch, xe đỗ chéo): nghiêng vài độ là Tesseract đã đọc nhầm 5<->9, mất chữ...
  const angle = skewAngle(pick.plate.lines);
  const { canvas: straight, map } = rotateCanvas(crop, Math.abs(angle) >= 0.6 * (Math.PI / 180) ? -angle : 0);

  // chuẩn cỡ chữ ~64px (Tesseract đọc tốt nhất ở cỡ này)
  const s = Math.min(4, Math.max(0.4, 64 / ch));
  out.width = Math.round(straight.width * s); out.height = Math.round(straight.height * s);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(straight, 0, 0, out.width, out.height);
  const pad = Math.round(64 * 0.5);
  const result = withPadding(out, pad);
  // vị trí biển số trên ảnh GỐC (để cắt ảnh màu vùng biển: ảnh lưu lịch sử, ảnh gửi nghiệp vụ)
  result.plateBox = { x: Math.round(x0 / scale), y: Math.round(y0 / scale), w: Math.round(cw / scale), h: Math.round(chh / scale) };
  // khung TỪNG KÝ TỰ của mỗi dòng (trái -> phải, toạ độ ảnh kết quả) – để OCR riêng ký tự seri chỉ cho phép chữ cái
  const toOut = (bx0, by0, bx1, by1) => {
    const pts = [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]].map(([px, py]) => map(px - x0, py - y0)).map(([px, py]) => [pad + px * s, pad + py * s]);
    return { l: Math.min(...pts.map((q) => q[0])), t: Math.min(...pts.map((q) => q[1])), r: Math.max(...pts.map((q) => q[0])), b: Math.max(...pts.map((q) => q[1])) };
  };
  // lưới 10x20 của từng ký tự (đã xoay thẳng) -> so khớp mẫu font biển VN (plateGlyphs.js)
  const rot = Math.abs(angle) >= 0.6 * (Math.PI / 180) ? -angle : 0;
  result.lineGlyphs = pick.plate.lines.map((ln) => [...ln.cs].sort((a, b) => a.cx - b.cx).map((c) => glyphOf(pick.label, w, c, rot)));
  const mc = ch * 0.18 * s;
  result.lineChars = pick.plate.lines.map((ln) => [...ln.cs].sort((a, b) => a.cx - b.cx).map((c) => {
    const o = toOut(c.minx, c.miny, c.maxx + 1, c.maxy + 1);
    const left = Math.max(0, Math.round(o.l - mc)), top = Math.max(0, Math.round(o.t - mc));
    return { left, top, width: Math.min(result.width, Math.round(o.r + mc)) - left, height: Math.min(result.height, Math.round(o.b + mc)) - top };
  }));
  // biển 2 dòng: khung từng dòng trên ảnh đã làm sạch -> OCR riêng từng dòng (đọc chung hay lẫn / ghép sai dòng)
  if (pick.plate.rows === 2) {
    // khung SÁT chữ của từng dòng (toạ độ ảnh kết quả, đã xoay)
    const core = pick.plate.lines.map((ln) => {
      const pts = [[ln.x0 - x0, ln.y0 - y0], [ln.x1 - x0 + 1, ln.y0 - y0], [ln.x0 - x0, ln.y1 - y0 + 1], [ln.x1 - x0 + 1, ln.y1 - y0 + 1]]
        .map(([px, py]) => map(px, py)).map(([px, py]) => [pad + px * s, pad + py * s]);
      return { l: Math.min(...pts.map((q) => q[0])), t: Math.min(...pts.map((q) => q[1])), r: Math.max(...pts.map((q) => q[0])), b: Math.max(...pts.map((q) => q[1])) };
    });
    // thêm lề quanh chữ nhưng KHÔNG lấn sang dòng kia: cắt tại giữa khoảng trống 2 dòng
    // (biển thật 2 dòng rất sát nhau – lề lấn sang thì OCR dòng trên thấy cả đầu chữ dòng dưới, vd "54" đọc thành "9L")
    const mid = (core[0].b + core[1].t) / 2;
    const mm = ch * 0.3 * s;
    result.lineRects = core.map((c, i) => {
      const left = Math.max(0, Math.round(c.l - mm));
      const right = Math.min(result.width, Math.round(c.r + mm));
      const top = Math.max(0, Math.round(i === 0 ? c.t - mm : Math.max(mid, c.t - mm)));
      const bottom = Math.min(result.height, Math.round(i === 0 ? Math.min(mid, c.b + mm) : c.b + mm));
      return { left, top, width: right - left, height: bottom - top };
    });
  }
  return result;
}

/**
 * Lưới GLYPH_W x GLYPH_H (tỉ lệ mực từng ô 0..1) của 1 ký tự = 1 khối mực đã tách, xoay thẳng theo độ nghiêng biển.
 * Cách chuẩn hoá giống hệt lúc sinh mẫu (khung bao ký tự kéo giãn đầy lưới) + tỉ lệ rộng/cao để phân biệt "1" hẹp.
 */
function glyphOf(label, w, c, rot) {
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const xs = [], ys = [];
  for (let y = c.miny; y <= c.maxy; y++) {
    for (let x = c.minx; x <= c.maxx; x++) {
      if (label[y * w + x] !== c.id) continue;
      const dx = x - c.cx, dy = y - c.cy;
      xs.push(dx * cos - dy * sin); ys.push(dx * sin + dy * cos);
    }
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < xs.length; i++) { if (xs[i] < x0) x0 = xs[i]; if (xs[i] > x1) x1 = xs[i]; if (ys[i] < y0) y0 = ys[i]; if (ys[i] > y1) y1 = ys[i]; }
  const gw = x1 - x0 + 1, gh = y1 - y0 + 1;
  const grid = new Float32Array(GLYPH_W * GLYPH_H);
  for (let i = 0; i < xs.length; i++) {
    const gx = Math.min(GLYPH_W - 1, Math.floor(((xs[i] - x0) / gw) * GLYPH_W));
    const gy = Math.min(GLYPH_H - 1, Math.floor(((ys[i] - y0) / gh) * GLYPH_H));
    grid[gy * GLYPH_W + gx] += 1;
  }
  const cell = (gw / GLYPH_W) * (gh / GLYPH_H);
  for (let k = 0; k < grid.length; k++) grid[k] = Math.min(1, grid[k] / cell);
  return { grid, aspect: gw / gh, h: c.h };
}

// mẫu: hex -> mảng 0..1 (giải mã 1 lần)
let glyphTable = null;
function templates() {
  if (!glyphTable) {
    glyphTable = Object.entries(GLYPHS).map(([ch, list]) => [ch, list.map(([aspect, hex]) => ({ aspect, grid: Float32Array.from(hex, (h) => parseInt(h, 16) / 15) }))]);
  }
  return glyphTable;
}

/** Ký tự giống nhất trong tập allowed: khoảng cách = sai khác trung bình từng ô + chênh tỉ lệ rộng/cao */
function classifyGlyph(gl, allowed) {
  let best = null, second = null;
  for (const [ch, list] of templates()) {
    if (!allowed.includes(ch)) continue;
    let d = Infinity;
    for (const t of list) {
      let s = 0;
      for (let k = 0; k < t.grid.length; k++) s += Math.abs(gl.grid[k] - t.grid[k]);
      d = Math.min(d, s / t.grid.length + Math.abs(gl.aspect - t.aspect) * 0.8);
    }
    if (!best || d < best.d) { second = best; best = { ch, d }; } else if (!second || d < second.d) second = { ch, d };
  }
  return { ch: best?.ch || '', dist: best?.d ?? 1, margin: second ? second.d - best.d : 1 };
}

/**
 * Đọc 1 dòng bằng so khớp mẫu, mỗi vị trí chỉ xét đúng loại ký tự của biển VN:
 *   'plate' : biển 1 dòng – ký tự 1-2 số (mã tỉnh), 3 chữ (seri), 4 chữ hoặc số, còn lại số (7-9 ký tự)
 *   'top'   : dòng trên biển 2 dòng – như 'plate' (3-5 ký tự)
 *   'digits': toàn số (dòng dưới biển 2 dòng)
 */
function readGlyphLine(glyphs, kind) {
  // bỏ mảnh rác (ký tự vỡ đôi khi ảnh mờ / nghiêng, ốc vít, dấu bẩn): dòng có nhiều ký tự hơn biển VN cho phép,
  // hoặc mảnh không giống ký tự nào (lệch mẫu > 0.42; ký tự thật thường 0.2-0.36) -> bỏ mảnh lệch nhất, giữ tối thiểu số ký tự của dòng
  const [minN, maxN] = kind === 'digits' ? [4, 5] : kind === 'top' ? [3, 5] : [7, 9];
  // mảnh vỡ thường THẤP hơn hẳn ký tự thật cùng dòng -> cộng điểm rác theo độ thấp so với chiều cao trung vị
  const hs = glyphs.map((gl) => gl.h).sort((a, b) => a - b);
  const medH = hs[Math.floor(hs.length / 2)] || 1;
  // + nét quá mảnh / lởm chởm (vạch gạch lát, dây, khe xe): độ đặc mực < 0.26 (ký tự biển thật 0.35-0.65)
  const ink = (gl) => gl.grid.reduce((t, v) => t + v, 0) / gl.grid.length;
  let list = glyphs.map((gl) => ({ gl, junk: classifyGlyph(gl, WL_ALNUM).dist + (gl.h < medH * 0.8 ? 0.5 : 0) + (ink(gl) < 0.26 ? 0.5 : 0) }));
  while (list.length > minN) {
    const worstI = list.reduce((wi, x, i) => (x.junk > list[wi].junk ? i : wi), 0);
    // biển 1 dòng: 7 hay 8 ký tự đều hợp lệ -> bỏ nhầm 1 ký tự thật vẫn ra biển "đúng mẫu" mà sai số -> chỉ bỏ mảnh RÕ là rác
    if (list.length <= maxN && list[worstI].junk <= (kind === 'plate' ? 0.6 : 0.42)) break;
    list = list.filter((_, i) => i !== worstI);
  }
  let text = '', worst = 0;
  list.map((x) => x.gl).forEach((gl, i) => {
    let r;
    if (kind !== 'digits' && i === 3) {
      // vị trí 4: là CHỮ chỉ khi seri 2 chữ (LD, KT, NG, AA...) – còn lại luôn là SỐ -> ưu tiên số
      const rd = classifyGlyph(gl, WL_DIGIT);
      const rl = classifyGlyph(gl, PLATE_LETTERS);
      const useLetter = (KNOWN_BY_KIND[kind].has(text[2] + rl.ch) && rl.dist <= rd.dist + 0.05) || rl.dist + 0.08 < rd.dist;
      r = useLetter ? rl : rd;
    } else {
      const allowed = kind === 'digits' ? WL_DIGIT : i < 2 ? WL_DIGIT : i === 2 ? PLATE_LETTERS : WL_DIGIT;
      r = classifyGlyph(gl, allowed);
    }
    text += r.ch; worst = Math.max(worst, r.dist);
  });
  return { text, worst };
}

/** Độ nghiêng (radian) của biển: hồi quy đường chân các ký tự từng dòng (trung bình theo số ký tự) */
function skewAngle(lines) {
  let sum = 0, n = 0;
  for (const ln of lines || []) {
    const pts = ln.cs.map((c) => [c.cx, c.maxy]);
    if (pts.length < 3) continue;
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    let num = 0, den = 0;
    for (const [px, py] of pts) { num += (px - mx) * (py - my); den += (px - mx) ** 2; }
    if (!den) continue;
    sum += Math.atan(num / den) * pts.length; n += pts.length;
  }
  const a = n ? sum / n : 0;
  return Math.abs(a) > (15 * Math.PI) / 180 ? 0 : a; // > 15°: nhiều khả năng đo sai -> không xoay
}

/** Xoay ảnh (nền trắng) quanh tâm; trả kèm hàm đổi toạ độ ảnh cũ -> ảnh mới */
function rotateCanvas(src, a) {
  if (!a) return { canvas: src, map: (x, y) => [x, y] };
  const cos = Math.cos(a), sin = Math.sin(a);
  const W = Math.ceil(Math.abs(src.width * cos) + Math.abs(src.height * sin));
  const H = Math.ceil(Math.abs(src.width * sin) + Math.abs(src.height * cos));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2); g.rotate(a); g.drawImage(src, -src.width / 2, -src.height / 2);
  const map = (x, y) => {
    const dx = x - src.width / 2, dy = y - src.height / 2;
    return [W / 2 + dx * cos - dy * sin, H / 2 + dx * sin + dy * cos];
  };
  return { canvas: c, map };
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
/*
 * Biển số VN (Thông tư 24/2023, 58/2020):
 *   Ô tô 1 dòng     : 2 số tỉnh + seri 1 chữ (hoặc 2 chữ: LD, KT, NG, NN...) + 4-5 số  -> 30A-123.45 | 30K-1234 | 29LD-012.34
 *   Ô tô biển vuông : dòng trên "30A", dòng dưới "123.45"                              -> 30A-123.45
 *   Xe máy (2 dòng) : dòng trên 2 số tỉnh + 1 chữ + 1 số ("59-X1"), dòng dưới 4-5 số  -> 59-X1 123.45 | 29-B1 1234
 *   Xe < 50cc / điện: seri 2 chữ (+ số) ("29-AA", "29-MĐ1")                           -> 29-AA 123.45
 * Seri chỉ dùng các chữ: A B C D E F G H K L M N P R S T U V X Y Z (không có I, J, O, Q, W).
 */
export const PLATE_LETTERS = 'ABCDEFGHKLMNPRSTUVXYZ';
// seri 2 chữ có thật: ô tô (biển 1 dòng) | xe máy dưới 50cc (dòng trên biển 2 dòng)
const CAR_SERIES2 = ['LD', 'KT', 'NG', 'NN', 'QT', 'CV', 'HC', 'NA', 'KD'];
const MOTO_SERIES2 = ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AH', 'AK'];
const KNOWN_SERIES2 = new Set([...CAR_SERIES2, ...MOTO_SERIES2]);
const KNOWN_BY_KIND = { plate: new Set(CAR_SERIES2), top: KNOWN_SERIES2 };
const TO_DIGIT = { O: '0', D: '0', Q: '0', U: '0', I: '1', L: '1', T: '1', J: '1', Z: '2', S: '5', B: '8', G: '6', A: '4' };
// chữ OCR nhầm sang số / chữ không có trên biển -> các chữ có thể (thử lần lượt, chọn cách hợp lệ nhất)
const LETTER_OPTS = {
  0: ['D'], 1: ['T', 'L'], 2: ['Z'], 3: ['B'], 4: ['A'], 5: ['S'], 6: ['G'], 7: ['T'], 8: ['B'],
  O: ['D'], Q: ['D'], I: ['T', 'L'], J: ['U'], W: ['V'],
};
const digit = (c) => (/[0-9]/.test(c) ? c : TO_DIGIT[c] || null);
const letterOpts = (c) => (PLATE_LETTERS.includes(c) ? [[c, 0]] : (LETTER_OPTS[c] || []).map((l) => [l, 1]));
const fmtTail = (t) => (t.length === 5 ? `${t.slice(0, 3)}.${t.slice(3)}` : t);

/**
 * Khớp chuỗi s (chỉ chữ + số) vào mẫu [tỉnh 2 số][seri serLen chữ][1 số nếu serDigit][đuôi tailLen số].
 * @returns {{prov, ser, tail, fixes, extra} | null}  fixes = số ký tự phải sửa (càng ít càng đúng)
 */
function match(s, serLen, serDigit, tailLen) {
  const need = 2 + serLen + (serDigit ? 1 : 0) + tailLen;
  if (s.length < need) return null;
  let fixes = 0;
  const prov = [s[0], s[1]].map((c) => { const d = digit(c); if (d && d !== c) fixes++; return d; });
  if (prov.includes(null) || +prov.join('') < 11) return null; // VN không có mã tỉnh 00-10
  let opts = [['', 0]];
  for (let i = 0; i < serLen; i++) {
    const o = letterOpts(s[2 + i]);
    if (!o.length) return null;
    opts = opts.flatMap(([p, f]) => o.map(([l, lf]) => [p + l, f + lf]));
  }
  // seri 2 chữ: ưu tiên seri có thật (LD, KT, NG...)
  opts = opts.map(([ser, f]) => [ser, f + (serLen === 2 && !KNOWN_SERIES2.has(ser) ? 1.5 : 0)]).sort((a, b) => a[1] - b[1]);
  let [ser, serFix] = opts[0];
  fixes += serFix;
  if (serDigit) {
    const c = s[2 + serLen]; const d = digit(c);
    if (!d) return null;
    if (d !== c) fixes += 1.5; // số seri xe máy mà OCR ra chữ -> kém tin cậy hơn
    ser += d;
  }
  let tail = '';
  for (const c of s.slice(need - tailLen, need)) { const d = digit(c); if (!d) return null; if (d !== c) fixes++; tail += d; }
  return { prov: prov.join(''), ser, tail, fixes, extra: s.length - need, serLen, serDigit };
}

const result = (c, twoRows) => {
  // xe máy (seri có số / seri 2 chữ trên biển 2 dòng): "59-X1 123.45" ; ô tô: "30A-123.45"
  const moto = c.serDigit || (twoRows && c.serLen === 2);
  const plate = moto ? `${c.prov}-${c.ser} ${fmtTail(c.tail)}` : `${c.prov}${c.ser}-${fmtTail(c.tail)}`;
  return { plate, valid: true, compact: `${c.prov}${c.ser}${c.tail}` };
};

/**
 * Chuẩn hoá chuỗi OCR (1 dòng) thành biển số VN.
 * @returns {{ plate: string, valid: boolean, compact: string }}
 */
export function parsePlate(text) {
  const upper = String(text || '').toUpperCase();
  const compact = upper.replace(/[^A-Z0-9]/g, '');
  if (compact.length < 7) return { plate: '', valid: false, compact };
  // vị trí dấu ngăn cách OCR đọc được (khoảng trắng, xuống dòng, - .) -> gợi ý chỗ tách "đầu biển | dãy số"
  const breaks = new Set();
  let pos = 0;
  for (const ch of upper) {
    if (/[A-Z0-9]/.test(ch)) pos++;
    else if (pos > 0) breaks.add(pos);
  }
  const candidates = [];
  for (let start = 0; start <= Math.min(2, compact.length - 7); start++) {
    const s = compact.slice(start);
    for (const serLen of [1, 2]) {
      for (const tailLen of [5, 4]) {
        for (const serDigit of [false, true]) {
          const m = match(s, serLen, serDigit, tailLen);
          if (!m) continue;
          const head = 2 + serLen + (serDigit ? 1 : 0);
          const score = m.fixes + (m.extra + start) * 3 + (serLen === 2 ? 1 : 0) + (tailLen === 4 ? 1 : 0) + (serDigit ? 1 : 0)
            - (breaks.has(start + head) ? 2 : 0);
          candidates.push({ ...m, score });
        }
      }
    }
  }
  if (!candidates.length) return { plate: '', valid: false, compact };
  candidates.sort((a, b) => a.score - b.score || b.tail.length - a.tail.length);
  return result(candidates[0], false);
}

/**
 * Biển 2 dòng (xe máy, ô tô biển vuông): dòng trên = mã tỉnh + seri, dòng dưới = 4-5 số.
 * Biết rõ dòng nào là phần nào -> không phải đoán chỗ tách như đọc chung 1 chuỗi.
 */
export function parsePlateRows(topText, bottomText) {
  const top = String(topText || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // dòng dưới: chỉ số (chữ nhầm -> số); có dấu "." thì lấy đúng 3 số trước + 2 số sau dấu
  const bRaw = String(bottomText || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const toDigits = (x) => [...x].map(digit).filter(Boolean).join('');
  let tail = toDigits(bRaw.replace(/\./g, ''));
  let tailFix = 0;
  if (tail.length > 5) {
    const [l, r = ''] = bRaw.split('.');
    const ld = toDigits(l), rd = toDigits(r);
    tail = ld.length >= 3 && rd.length >= 2 ? ld.slice(-3) + rd.slice(0, 2) : tail.slice(0, 5);
    tailFix = 1.5;
  }
  if (tail.length < 4 || top.length < 3) return { plate: '', valid: false, compact: top + tail };
  // các kiểu dòng trên: L+số (xe máy, phổ biến nhất) | 1 chữ (ô tô biển vuông) | 2 chữ | 2 chữ + số (xe điện "MĐ1")
  const kinds = [[1, true, 0], [1, false, 0.6], [2, false, 1], [2, true, 1.5]];
  const candidates = [];
  for (let start = 0; start <= Math.min(1, top.length - 3); start++) {
    for (const [serLen, serDigit, base] of kinds) {
      const m = match(top.slice(start) + tail, serLen, serDigit, tail.length);
      if (!m) continue;
      // dòng trên phải dùng HẾT ký tự (thừa ký tự ở dòng trên = tách sai kiểu)
      const headLen = 2 + serLen + (serDigit ? 1 : 0);
      const leftover = top.length - start - headLen;
      if (leftover < 0) continue;
      candidates.push({ ...m, tail, score: m.fixes + base + tailFix + (leftover + start) * 2.5 });
    }
  }
  if (!candidates.length) return { plate: '', valid: false, compact: top + tail };
  candidates.sort((a, b) => a.score - b.score);
  return result(candidates[0], true);
}

// ===================== Đọc =====================

const WL_ALL = `${PLATE_LETTERS}0123456789-.`;
const WL_DIGITS = '0123456789.';
const WL_DIGIT = '0123456789';
const WL_ALNUM = `${PLATE_LETTERS}0123456789`;

/** OCR 1 vùng (hoặc cả ảnh) ở chế độ 1 dòng chữ, chỉ cho phép các ký tự whitelist */
async function ocrLine(worker, image, whitelist, rectangle) {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: whitelist });
  const { data } = await worker.recognize(image, rectangle ? { rectangle } : {});
  return data;
}

/**
 * Ký tự thứ 3 của biển (dòng trên xe máy / biển 1 dòng ô tô) LUÔN là chữ seri. OCR cả dòng hay ra số ở đó
 * (L -> "1", B -> "8", D -> "0"...) -> đọc lại RIÊNG ký tự đó, chỉ cho phép chữ cái có trên biển VN, thay vào chuỗi.
 * Chỉ làm khi số ký tự OCR khớp số ký tự tách được (biết chắc ký tự nào là ký tự thứ 3).
 */
async function fixSeriesLetter(worker, image, text, chars) {
  const compact = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!chars || chars.length < 3 || compact.length !== chars.length || PLATE_LETTERS.includes(compact[2])) return text;
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR, tessedit_char_whitelist: PLATE_LETTERS });
  const { data } = await worker.recognize(image, { rectangle: chars[2] });
  const letter = (data.text || '').trim().toUpperCase()[0];
  if (!letter || !PLATE_LETTERS.includes(letter)) return text;
  // thay đúng ký tự chữ/số thứ 3 trong chuỗi gốc (giữ dấu - . khoảng trắng – parsePlate dùng làm gợi ý tách)
  let n = 0;
  return [...String(text).toUpperCase()].map((c) => (/[A-Z0-9]/.test(c) && n++ === 2 ? letter : c)).join('');
}


const confOf = (data) => {
  // Tesseract đôi khi báo độ tin cậy tổng = 0 dù đọc đúng -> lấy trung bình độ tin cậy từng ký tự
  if (data.confidence) return data.confidence;
  const syms = (data.symbols || []).map((s) => s.confidence).filter((c) => c > 0);
  return syms.length ? syms.reduce((a, b) => a + b, 0) / syms.length : null;
};

/**
 * CÁCH 1 (chính): so khớp từng ký tự đã tách với mẫu font biển VN (plateGlyphs.js) – không cần OCR, nhanh, đúng font.
 * Ra biển hợp lệ + đủ giống mẫu (lệch <= 0.6) -> dùng luôn; ngược lại -> null (dùng cách 2: Tesseract).
 * Độ tin cậy quy đổi từ độ lệch của ký tự KÉM giống nhất: 0.25 -> ~89%, 0.45 -> ~44%, 0.6 -> ~11%.
 */
const GLYPH_MAX_DIST = 0.6;
function readByGlyphs(clean) {
  const lines = clean.lineGlyphs;
  if (!clean.plateBox || !lines?.length) return null;
  let parsed, raw, worst;
  if (lines.length === 2 && clean.lineRects) {
    const top = readGlyphLine(lines[0], 'top');
    const bottom = readGlyphLine(lines[1], 'digits');
    parsed = parsePlateRows(top.text, bottom.text);
    raw = `${top.text}\n${bottom.text}`;
    worst = Math.max(top.worst, bottom.worst);
  } else {
    const one = readGlyphLine(lines[0], 'plate');
    parsed = parsePlate(one.text);
    raw = one.text;
    worst = one.worst;
  }
  if (!parsed.valid || worst > GLYPH_MAX_DIST) return null;
  return { parsed, raw, confidence: Math.max(0, Math.min(1, (0.65 - worst) / 0.45)) * 100 };
}

/**
 * Đọc biển số từ 1 canvas / ảnh (đã cắt vùng có biển hoặc cả khung camera – tự định vị biển).
 *   Cách 1: so khớp mẫu font biển VN (readByGlyphs)  ->  không ra / không chắc  ->  Cách 2: Tesseract OCR.
 * @param {HTMLCanvasElement|HTMLImageElement} source
 * @returns {Promise<{plate, valid, compact, raw, confidence, image, box, method}>}
 *   image = dataURL ảnh đã làm sạch (để xem / lưu); method = 'glyph' | 'ocr' (cách đã đọc ra kết quả)
 */
export function readPlate(source) {
  const job = queue.then(async () => {
    const clean = preprocess(source);
    const done = (parsed, raw, confidence, method) => ({
      ...parsed, raw, method, confidence: confidence == null ? null : Math.round(confidence),
      image: clean.toDataURL('image/png'), box: clean.plateBox || null,
    });

    const g = readByGlyphs(clean);
    if (g) return done(g.parsed, g.raw, g.confidence, 'glyph');

    // Cách 2: Tesseract
    const worker = await getWorker();
    let parsed; let raw; let confidence;
    if (clean.lineRects?.length === 2) {
      // biển 2 dòng: đọc riêng từng dòng; dòng dưới chỉ có số
      const [t, b] = clean.lineRects;
      const top = await ocrLine(worker, clean, WL_ALL, t);
      const bottom = await ocrLine(worker, clean, WL_DIGITS, b);
      const topText = await fixSeriesLetter(worker, clean, top.text, clean.lineChars?.[0]);
      raw = `${(topText || '').trim()}\n${(bottom.text || '').trim()}`;
      parsed = parsePlateRows(topText, bottom.text);
      if (!parsed.valid) parsed = parsePlate(raw.replace('\n', ' '));
      const cs = [confOf(top), confOf(bottom)].filter((c) => c != null);
      confidence = cs.length ? cs.reduce((a, c) => a + c, 0) / cs.length : null;
    } else {
      // biển 1 dòng (đã định vị) -> chế độ 1 dòng; không định vị được -> để Tesseract tự chia khối
      const data = clean.plateBox
        ? await ocrLine(worker, clean, WL_ALL)
        : (await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: WL_ALL }), (await worker.recognize(clean)).data);
      raw = (await fixSeriesLetter(worker, clean, data.text, clean.plateBox && clean.lineChars?.[0]) || '').trim();
      parsed = parsePlate(raw);
      confidence = confOf(data);
    }
    return done(parsed, raw, confidence, 'ocr');
  });
  queue = job.catch(() => {});
  return job;
}
