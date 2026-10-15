/**
 * Dựng cây menu từ bảng phẳng có Menu_Id (mã) và Menu_Id0 (mã cha).
 * - Giữ nguyên thứ tự dòng như proc trả về (cha có thể nằm sau con).
 * - Dòng có Bar = '---' là đường kẻ phân cách.
 * - Con của một dòng '---' (lỗi dữ liệu) được gắn lên cha của dòng đó.
 * - Bỏ ký tự '&' (phím tắt kiểu WinForms) trong tiêu đề.
 *
 * Mỗi node: { id, parentId, text, accel, icon, color, iconColor, isMaxForm, isShowTab, tag, url,
 *             phanHe, module, separator, children: [], raw }
 */
const pick = (o, ...keys) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};

export const cleanText = (s) => String(s ?? '').replace(/&(?!&)/g, '').trim();

function rawText(row, lang) {
  const vi = pick(row, 'Bar', 'bar');
  const en = pick(row, 'Bar2', 'bar2');
  return lang === 'E' ? en || vi : vi || en;
}

export function menuText(row, lang = 'V') {
  return parseAccel(rawText(row, lang)).text;
}

/**
 * Tách phím tắt kiểu WinForms: '&Báo cáo' -> { text: 'Báo cáo', accel: 0 } ; '&&' là ký tự & thật.
 * accel = vị trí ký tự được gạch chân (-1 nếu không có).
 */
export function parseAccel(s) {
  const src = String(s ?? '');
  let out = '';
  let accel = -1;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '&') {
      if (src[i + 1] === '&') { out += '&'; i++; continue; }
      if (accel < 0 && i + 1 < src.length && src[i + 1] !== ' ') accel = out.length;
      continue;
    }
    out += ch;
  }
  const lead = out.length - out.trimStart().length;
  const text = out.trim();
  if (accel >= 0) accel -= lead;
  if (accel < 0 || accel >= text.length) accel = -1;
  return { text, accel };
}

export function buildMenuTree(rows = [], lang = 'V') {
  const nodes = new Map();
  const order = [];

  rows.forEach((r) => {
    const id = String(pick(r, 'Menu_Id', 'menu_id') ?? '').trim();
    if (!id) return;
    const { text, accel } = parseAccel(rawText(r, lang));
    const node = {
      id,
      parentId: String(pick(r, 'Menu_Id0', 'menu_id0') ?? '').trim(),
      text,
      accel,
      separator: text === '---' || text === '-',
      icon: pick(r, 'Icon', 'icon') || '',
      iconColor: pick(r, 'ForeColor_Icon') || '',
      color: pick(r, 'ForeColor') || '',
      isMaxForm: Number(pick(r, 'IsMaxForm', 'isMaxForm') || 0) === 1,
      isShowTab: Number(pick(r, 'isShowTab', 'IsShowTab') || 0) === 1,
      tag: pick(r, 'Tag', 'tag') || '',
      url: pick(r, 'url', 'Url') || '',
      phanHe: pick(r, 'Stt_Phan_he') || '',
      module: pick(r, 'Stt_Module') || '',
      children: [],
      raw: r,
    };
    if (!nodes.has(id)) order.push(id);
    nodes.set(id, node);
  });

  const roots = [];
  const resolveParent = (pid) => {
    let p = nodes.get(pid);
    // nếu cha là dòng phân cách thì đẩy lên ông
    while (p && p.separator) p = nodes.get(p.parentId);
    return p;
  };

  order.forEach((id) => {
    const node = nodes.get(id);
    const parent = node.parentId && node.parentId !== id ? resolveParent(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  // Bỏ đường kẻ ở đầu/cuối và đường kẻ liền nhau
  const tidy = (list) => {
    const out = [];
    list.forEach((n) => {
      if (n.separator && (out.length === 0 || out[out.length - 1].separator)) return;
      n.children = tidy(n.children);
      out.push(n);
    });
    while (out.length && out[out.length - 1].separator) out.pop();
    return out;
  };

  return tidy(roots);
}

/** Lấy tất cả node lá (chức năng mở được) */
export function flattenLeaves(tree, path = []) {
  const out = [];
  tree.forEach((n) => {
    if (n.separator) return;
    if (n.children.length) out.push(...flattenLeaves(n.children, [...path, n.text]));
    else out.push({ ...n, path });
  });
  return out;
}

/** Lọc cây theo từ khoá (không dấu), giữ lại cha của node khớp */
export function filterTree(tree, keyword) {
  const k = normalize(keyword);
  if (!k) return tree;
  const walk = (list) =>
    list
      .map((n) => {
        if (n.separator) return null;
        if (normalize(n.text).includes(k) || n.id.toLowerCase().includes(k)) return n;
        const children = walk(n.children);
        return children.length ? { ...n, children } : null;
      })
      .filter(Boolean);
  return walk(tree);
}

export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}
