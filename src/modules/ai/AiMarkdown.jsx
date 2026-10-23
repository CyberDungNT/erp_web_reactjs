import { Fragment } from 'react';
import Icon from '@/components/icons/Icon';

/**
 * Hiển thị câu trả lời Markdown của trợ lý AI – dựng thẳng thành phần tử React (KHÔNG dùng innerHTML -> không chèn được mã độc).
 * Hỗ trợ: tiêu đề, đoạn văn, **đậm**, *nghiêng*, `mã`, khối ```mã```, danh sách (2 cấp), bảng, trích dẫn, đường kẻ, liên kết.
 * Liên kết [Tên](menu:MENU_ID) -> nút mở chức năng (chỉ khi MENU_ID có thật – isMenu(id)); [Tên](https://...) -> mở tab mới.
 *
 *   <AiMarkdown text={md} onMenu={(id) => openMenu(...)} isMenu={(id) => nodeMap.has(id)} />
 */
export default function AiMarkdown({ text, onMenu, isMenu }) {
  const blocks = parseBlocks(String(text || ''));
  const ctx = { onMenu, isMenu };
  return <div className="ai-md">{blocks.map((b, i) => renderBlock(b, i, ctx))}</div>;
}

// ---------------- Khối ----------------
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const splitRow = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

function parseBlocks(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    // ```mã```  (đang trả lời dở: chưa có dấu đóng -> lấy tới cuối)
    const fence = /^\s*```(\w*)/.exec(line);
    if (fence) {
      const body = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i += 1;
      out.push({ type: 'code', lang: fence[1], text: body.join('\n') });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { out.push({ type: 'h', level: Math.min(h[1].length, 4), text: h[2] }); i += 1; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push({ type: 'hr' }); i += 1; continue; }

    // bảng: dòng có | + dòng kẻ |---|
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
      out.push({ type: 'table', head, rows });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push({ type: 'quote', blocks: parseBlocks(body.join('\n')) });
      continue;
    }
    if (LIST_RE.test(line)) {
      const items = [];
      while (i < lines.length) {
        const m = LIST_RE.exec(lines[i]);
        if (m) {
          items.push({ indent: m[1].replace(/\t/g, '  ').length, ordered: /\d/.test(m[2]), num: parseInt(m[2], 10), text: m[3] });
          i += 1;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1].text += ' ' + lines[i].trim(); // dòng tiếp của mục
          i += 1;
        } else break;
      }
      out.push(nestList(items));
      continue;
    }
    // đoạn văn: gom tới dòng trống / khối khác
    const para = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !LIST_RE.test(lines[i]) && !/^(#{1,6}\s|\s*```|\s*>)/.test(lines[i])
      && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) para.push(lines[i++]);
    out.push({ type: 'p', lines: para });
  }
  return out;
}

/** Danh sách 2 cấp: mục thụt vào (>= 2 khoảng trắng) là mục con của mục ngay trên */
function nestList(items) {
  const base = items[0].indent;
  const root = { type: 'list', ordered: items[0].ordered, start: items[0].num || 1, items: [] };
  for (const it of items) {
    const parent = root.items[root.items.length - 1];
    if (it.indent >= base + 2 && parent) {
      parent.sub = parent.sub || { type: 'list', ordered: it.ordered, start: it.num || 1, items: [] };
      parent.sub.items.push({ text: it.text });
    } else root.items.push({ text: it.text });
  }
  return root;
}

function renderBlock(b, key, ctx) {
  switch (b.type) {
    case 'code': return <pre key={key} className="ai-md__pre"><code>{b.text}</code></pre>;
    case 'h': { const H = `h${b.level + 2 > 6 ? 6 : b.level + 2}`; return <H key={key} className="ai-md__h">{inline(b.text, ctx)}</H>; }
    case 'hr': return <hr key={key} />;
    case 'quote': return <blockquote key={key}>{b.blocks.map((x, i) => renderBlock(x, i, ctx))}</blockquote>;
    case 'table':
      return (
        <div key={key} className="ai-md__table">
          <table>
            <thead><tr>{b.head.map((c, i) => <th key={i}>{inline(c, ctx)}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, ri) => <tr key={ri}>{b.head.map((_, ci) => <td key={ci}>{inline(r[ci] || '', ctx)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case 'list': return renderList(b, key, ctx);
    default:
      return <p key={key}>{b.lines.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{inline(l, ctx)}</Fragment>)}</p>;
  }
}

function renderList(b, key, ctx) {
  const L = b.ordered ? 'ol' : 'ul';
  return (
    <L key={key} start={b.ordered && b.start !== 1 ? b.start : undefined}>
      {b.items.map((it, i) => <li key={i}>{inline(it.text, ctx)}{it.sub && renderList(it.sub, 'sub', ctx)}</li>)}
    </L>
  );
}

// ---------------- Trong dòng ----------------
// thứ tự ưu tiên: `mã` | [chữ](liên kết) | **đậm** | *nghiêng* / _nghiêng_
const INLINE_RE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|(?<![\p{L}\d])_([^_\s][^_]*)_(?![\p{L}\d])/gu;

function inline(text, ctx) {
  const out = [];
  let last = 0;
  let k = 0;
  // matchAll: mỗi lần gọi dùng bản sao riêng của regex – inline() gọi đệ quy (chữ đậm lồng nghiêng) không làm hỏng vị trí dò của lần ngoài
  for (const m of text.matchAll(INLINE_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] != null) out.push(<code key={k++}>{m[1]}</code>);
    else if (m[2] != null) out.push(link(m[2], m[3], k++, ctx));
    else if (m[4] != null || m[5] != null) out.push(<strong key={k++}>{inline(m[4] ?? m[5], ctx)}</strong>);
    else out.push(<em key={k++}>{inline(m[6] ?? m[7], ctx)}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function link(label, href, key, { onMenu, isMenu }) {
  const menu = /^menu:(.+)$/i.exec(href);
  if (menu) {
    const id = decodeURIComponent(menu[1]).trim();
    if (!isMenu?.(id)) return <strong key={key}>{label}</strong>; // mã không có / không có quyền -> chữ thường
    return (
      <button key={key} type="button" className="ai-md__menu" title={`Mở chức năng (${id})`} onClick={() => onMenu?.(id)}>
        <Icon name="file" size={12} strokeWidth={2.2} />{label}<Icon name="chevronRight" size={11} strokeWidth={2.4} />
      </button>
    );
  }
  if (/^https?:\/\//i.test(href)) {
    return <a key={key} href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
  }
  return <Fragment key={key}>{label}</Fragment>; // giao thức khác (javascript:, data:...) -> chỉ hiện chữ
}
