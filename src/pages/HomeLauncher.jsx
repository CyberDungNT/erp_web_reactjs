import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/icons/Icon';
import { useMain } from '../layouts/MainLayout';
import { flattenLeaves, normalize } from '../utils/menuTree';
import './home.css';

/**
 * Trang HOME (PageName = FrmReference): tìm nhanh chức năng + lưới chức năng lọc theo phân hệ.
 * Dữ liệu lấy từ menu trái (bảng MENU_TABLE.left); tìm kiếm quét cả menu trái và menu trên.
 */
const PALETTES = ['blue', 'teal', 'pink', 'violet', 'amber'];
const MIN_TILE = 190;

export default function HomeLauncher() {
  const { leftTree, topTree, openMenu, lang } = useMain();
  const [kw, setKw] = useState('');
  const [group, setGroup] = useState('ALL');
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const [cols, setCols] = useState(5);
  const gridRef = useRef(null);
  const chipsRef = useRef(null);
  const [chipInk, setChipInk] = useState(null); // nền trượt dưới nhóm đang chọn

  // Các phân hệ (nhóm gốc của menu trái có chức năng bên trong)
  const groups = useMemo(() => leftTree
    .filter((n) => !n.separator && n.id !== 'DEV')
    .map((n, i) => ({ node: n, palette: PALETTES[i % PALETTES.length], leaves: flattenLeaves(n.children.length ? n.children : [n]) }))
    .filter((g) => g.leaves.length), [leftTree]);

  const allLeaves = useMemo(() => {
    const seen = new Set();
    const out = [];
    groups.forEach((g) => g.leaves.forEach((l) => {
      if (!seen.has(l.id)) { seen.add(l.id); out.push({ ...l, group: g.node.text, palette: g.palette }); }
    }));
    flattenLeaves(topTree).forEach((l) => {
      if (!seen.has(l.id)) { seen.add(l.id); out.push({ ...l, group: l.path?.[0] || '', palette: 'slate', fromTop: true }); }
    });
    return out;
  }, [groups, topTree]);

  const k = normalize(kw);
  const items = useMemo(() => {
    if (k) return allLeaves.filter((l) => normalize(l.text).includes(k) || l.id.toLowerCase().includes(k));
    const base = allLeaves.filter((l) => !l.fromTop);
    return group === 'ALL' ? base : base.filter((l) => l.group === group);
  }, [allLeaves, k, group]);

  // Số cột theo độ rộng, 2 hàng mỗi trang
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setCols(Math.max(2, Math.min(6, Math.floor(e.contentRect.width / MIN_TILE)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pageSize = cols * 2;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => { setPage(0); }, [k, group, pageSize]);
  const go = (p) => {
    const n = Math.max(0, Math.min(pages - 1, p));
    if (n === page) return;
    setDir(n > page ? 1 : -1);
    setPage(n);
  };
  const shown = items.slice(page * pageSize, page * pageSize + pageSize);

  useLayoutEffect(() => {
    const measure = () => {
      const el = chipsRef.current?.querySelector('.hl__chip.is-on');
      setChipInk(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null);
    };
    measure();
    document.fonts?.ready.then(measure);
  }, [group, groups, k, lang]);

  const pickGroup = (g, el) => {
    setGroup(g);
    setKw('');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const onSearchKey = (e) => {
    if (e.key === 'Enter' && items[0]) openMenu(items[0]);
    if (e.key === 'Escape') setKw('');
  };

  const T = lang === 'E'
    ? { a: 'What do you want to do', b: 'today?', sub: 'Pick a function or search by name.', ph: 'Search functions...', fn: 'Functions', all: 'All', none: 'No matching function', res: 'results for' }
    : { a: 'Bạn muốn làm gì', b: 'Hôm nay?', sub: 'Chọn một chức năng hoặc tìm nhanh theo tên.', ph: 'Tìm kiếm chức năng...', fn: 'Chức năng', all: 'Tất cả', none: 'Không tìm thấy chức năng phù hợp', res: 'kết quả cho' };

  return (
    <div className="hl">
      <h1 className="hl__title">{T.a} <span>{T.b}</span></h1>
      <p className="hl__sub">{T.sub}</p>

      <div className="hl__search">
        <Icon name="search" size={19} />
        <input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={onSearchKey} placeholder={T.ph} aria-label={T.ph} />
        {kw && (
          <button type="button" className="hl__search-clear" onClick={() => setKw('')} title="Xoá">
            <Icon name="close" size={13} strokeWidth={2.2} />
          </button>
        )}
      </div>

      <section className="hl__card">
        <div className="hl__card-head">
          <h2>{k ? <>{items.length} {T.res} “{kw}”</> : T.fn}</h2>
        </div>
        {!k && (
          <div className="hl__chips" ref={chipsRef} role="tablist">
            <button type="button" role="tab" aria-selected={group === 'ALL'} className={`hl__chip ${group === 'ALL' ? 'is-on' : ''}`}
              onClick={(e) => pickGroup('ALL', e.currentTarget)}>{T.all}</button>
            {groups.map((g) => (
              <button key={g.node.id} type="button" role="tab" aria-selected={group === g.node.text}
                className={`hl__chip ${group === g.node.text ? 'is-on' : ''}`}
                onClick={(e) => pickGroup(g.node.text, e.currentTarget)}>
                <i />{g.node.text}
              </button>
            ))}
            <span className={`hl__chip-ink ${chipInk ? 'is-on' : ''}`} aria-hidden="true"
              style={chipInk ? { transform: `translate(${chipInk.x}px, ${chipInk.y}px)`, width: chipInk.w, height: chipInk.h } : undefined} />
          </div>
        )}

        <div className="hl__stage">
          {pages > 1 && page > 0 && (
            <button type="button" className="hl__nav hl__nav--prev" onClick={() => go(page - 1)} aria-label="Trang trước">
              <Icon name="chevronLeft" size={18} strokeWidth={2.2} />
            </button>
          )}
          <div className="hl__grid-wrap" ref={gridRef}>
            <div key={`${page}-${group}-${k}`} className={`hl__grid ${dir > 0 ? 'from-right' : 'from-left'}`}
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {shown.map((l, i) => (
                <button key={l.id} type="button" className={`hl__tile hl__tile--${l.palette}`} style={{ '--i': i }}
                  onClick={() => openMenu(l)}
                  title={`${l.group ? l.group + ' › ' : ''}${l.text} (${l.id})`}>
                  <span className="hl__tile-icon"><Icon name="doc" size={26} strokeWidth={1.6} /></span>
                  <span className="hl__tile-text">{l.text}</span>
                  {k && l.group && <span className="hl__tile-group">{l.group}</span>}
                </button>
              ))}
              {!shown.length && <div className="hl__empty"><Icon name="search" size={22} /> {T.none}</div>}
            </div>
          </div>
          {pages > 1 && page < pages - 1 && (
            <button type="button" className="hl__nav hl__nav--next" onClick={() => go(page + 1)} aria-label="Trang sau">
              <Icon name="chevronRight" size={18} strokeWidth={2.2} />
            </button>
          )}
        </div>

        {pages > 1 && (
          <div className="hl__dots">
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} type="button" className={i === page ? 'is-on' : ''} onClick={() => go(i)} aria-label={`Trang ${i + 1}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
