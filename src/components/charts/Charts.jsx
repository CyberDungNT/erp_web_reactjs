import { useEffect, useMemo, useRef, useState } from 'react';
import './charts.css';

/**
 * BIỂU ĐỒ SVG GỌN NHẸ (không cần thư viện ngoài).
 *   <LineChart data={rows} x="Thang" series={[{ key: 'NamNay', name: 'Năm nay' }, ...]} format={fmtMoney} />
 *   <BarList data={rows} label="Ten" value="DoanhThu" format={fmtMoney} />
 *   <StackBar data={rows} label="Nhom" value="DoanhThu" format={fmtMoney} />
 *   <Sparkline values={[...]} />
 *
 * Màu theo thứ tự cố định SERIES (đã kiểm tra phân biệt được với người mù màu) – không xoay vòng.
 * Chữ (nhãn, giá trị) luôn dùng màu chữ, màu series chỉ dùng cho nét / khối.
 */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

/** 1234567890 -> "1,23 tỷ" / "350 tr" / "12,5 N" */
export function fmtCompact(v, unit = '') {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const f = (x, d) => x.toLocaleString('vi-VN', { maximumFractionDigits: d });
  const s = a >= 1e9 ? `${f(n / 1e9, 2)} tỷ` : a >= 1e6 ? `${f(n / 1e6, 1)} tr` : a >= 1e3 ? `${f(n / 1e3, 1)} N` : f(n, 0);
  return unit ? `${s} ${unit}` : s;
}

/** Theo dõi độ rộng phần tử để vẽ lại SVG khi đổi kích thước */
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Giá trị trần "đẹp" cho trục: 4 vạch chia */
function niceMax(max) {
  if (max <= 0) return 1;
  const step0 = max / 4;
  const p = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= step0);
  return step * 4;
}

// =================================================================
// LINE CHART – nhiều đường, thanh dọc dò theo trục X + tooltip mọi series
// =================================================================
export function LineChart({ data = [], x, series = [], height = 280, format = fmtCompact, area = true, ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const endLabels = series.length <= 4; // ít series -> ghi tên ở cuối mỗi đường (không chỉ dựa vào màu)
  const m = { l: 58, r: endLabels ? 104 : 16, t: 14, b: 30 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = height - m.t - m.b;
  const colored = series.map((s, i) => ({ ...s, color: s.color || SERIES[i] }));
  const max = niceMax(Math.max(0, ...data.flatMap((d) => colored.map((s) => Number(d[s.key]) || 0))));
  const px = (i) => (data.length <= 1 ? iw / 2 : (i * iw) / (data.length - 1));
  const py = (v) => ih - ((Number(v) || 0) / max) * ih;
  const ticks = [0, 1, 2, 3, 4].map((k) => (max * k) / 4);
  const xEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(iw / 64))));

  const pick = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const rel = clientX - r.left - m.l;
    const i = data.length <= 1 ? 0 : Math.round((rel / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover((h) => Math.max(0, Math.min(data.length - 1, (h ?? data.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
  };

  const h = hover != null ? data[hover] : null;
  const tipLeft = hover != null ? m.l + px(hover) : 0;

  return (
    <div ref={ref} className="ch ch--line" style={{ height }} tabIndex={0} role="img" aria-label={ariaLabel}
      onPointerMove={(e) => pick(e.clientX)} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height}>
          <defs>
            {colored.map((s, i) => (
              <linearGradient key={s.key} id={`ch-area-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity={i === 0 ? 0.18 : 0} />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          <g transform={`translate(${m.l},${m.t})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className={t === 0 ? 'ch__base' : 'ch__grid'} x1={0} x2={iw} y1={py(t)} y2={py(t)} />
                <text className="ch__tick" x={-8} y={py(t)} dy="0.32em" textAnchor="end">{format(t)}</text>
              </g>
            ))}
            {data.map((d, i) => (i % xEvery === 0 || i === data.length - 1) && (
              <text key={i} className="ch__tick" x={px(i)} y={ih + 20} textAnchor="middle">{d[x]}</text>
            ))}
            {colored.map((s, si) => {
              const pts = data.map((d, i) => `${px(i)},${py(d[s.key])}`);
              return (
                <g key={s.key} style={{ '--d': `${si * 0.15}s` }}>
                  {area && si === 0 && data.length > 1 && (
                    <path className="ch__area" d={`M${pts.join('L')}L${px(data.length - 1)},${ih}L${px(0)},${ih}Z`} fill={`url(#ch-area-${s.key})`} />
                  )}
                  <path className="ch__line" d={`M${pts.join('L')}`} stroke={s.color} pathLength="1" />
                </g>
              );
            })}
            {endLabels && data.length > 0 && (() => {
              // nhãn cuối đường: đẩy cách nhau tối thiểu 14px để không chồng lên nhau
              const last = data.length - 1;
              const labels = colored.map((s) => ({ s, y: py(data[last][s.key]) })).sort((a, b) => a.y - b.y);
              for (let i = 1; i < labels.length; i += 1) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 14);
              return labels.map(({ s, y }) => (
                <g key={s.key} className="ch__end" style={{ '--d': '1s' }}>
                  <circle cx={px(last)} cy={py(data[last][s.key])} r="4" fill={s.color} className="ch__dot" />
                  <text x={px(last) + 10} y={y} dy="0.32em" className="ch__end-label">{s.name}</text>
                </g>
              ));
            })()}
            {h && (
              <g className="ch__hover">
                <line className="ch__cross" x1={px(hover)} x2={px(hover)} y1={0} y2={ih} />
                {colored.map((s) => (
                  <circle key={s.key} cx={px(hover)} cy={py(h[s.key])} r="5" fill={s.color} className="ch__dot" />
                ))}
              </g>
            )}
          </g>
        </svg>
      )}
      {h && (
        <div className={`ch__tip ${tipLeft > width * 0.65 ? 'is-left' : ''}`} style={{ left: tipLeft, top: m.t }}>
          <div className="ch__tip-head">{h[x]}</div>
          {colored.map((s) => (
            <div key={s.key} className="ch__tip-row">
              <i style={{ background: s.color }} />
              <b>{format(h[s.key])}</b>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =================================================================
// BAR LIST – thanh ngang xếp hạng, nhãn + giá trị luôn hiển thị
// =================================================================
export function BarList({ data = [], label, value, format = fmtCompact, color = SERIES[0], max: maxProp }) {
  const total = data.reduce((s, d) => s + (Number(d[value]) || 0), 0);
  const max = maxProp || Math.max(1, ...data.map((d) => Number(d[value]) || 0));
  const [hover, setHover] = useState(null);
  return (
    <ul className="ch-bars">
      {data.map((d, i) => {
        const v = Number(d[value]) || 0;
        return (
          <li key={i} className={`ch-bars__row ${hover === i ? 'is-hover' : ''}`} tabIndex={0}
            onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            title={`${d[label]}: ${format(v)} (${total ? ((v / total) * 100).toFixed(1) : 0}%)`}>
            <span className="ch-bars__label">{d[label]}</span>
            <span className="ch-bars__track">
              <span className="ch-bars__fill" style={{ width: `${(v / max) * 100}%`, background: color, '--i': i }} />
            </span>
            <span className="ch-bars__value">{format(v)}</span>
          </li>
        );
      })}
    </ul>
  );
}

// =================================================================
// STACK BAR – 1 thanh 100% thể hiện cơ cấu + chú thích có giá trị & %
// =================================================================
export function StackBar({ data = [], label, value, format = fmtCompact }) {
  const total = data.reduce((s, d) => s + (Number(d[value]) || 0), 0) || 1;
  const [hover, setHover] = useState(null);
  const items = useMemo(() => data.map((d, i) => ({ ...d, color: SERIES[i % SERIES.length], pct: ((Number(d[value]) || 0) / total) * 100 })), [data, value, total]);
  return (
    <div className="ch-stack">
      <div className="ch-stack__bar" role="img" aria-label={items.map((d) => `${d[label]} ${d.pct.toFixed(1)}%`).join(', ')}>
        {items.map((d, i) => (
          <span key={i} className={`ch-stack__seg ${hover === i ? 'is-hover' : ''} ${hover != null && hover !== i ? 'is-dim' : ''}`}
            style={{ flexGrow: d.pct, background: d.color, '--i': i }}
            onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
        ))}
      </div>
      <ul className="ch-legend ch-legend--list">
        {items.map((d, i) => (
          <li key={i} className={hover === i ? 'is-hover' : ''} tabIndex={0}
            onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            <i style={{ background: d.color }} />
            <span className="ch-legend__name">{d[label]}</span>
            <b>{d.pct.toFixed(1)}%</b>
            <span className="ch-legend__val">{format(d[value])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =================================================================
// SPARKLINE – đường xu hướng nhỏ trong ô KPI
// =================================================================
export function Sparkline({ values = [], color = SERIES[0], height = 36 }) {
  const [ref, width] = useWidth();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const px = (i) => (values.length <= 1 ? width / 2 : (i * (width - 6)) / (values.length - 1) + 3);
  const py = (v) => height - 4 - ((v - min) / span) * (height - 8);
  const d = values.map((v, i) => `${px(i)},${py(v)}`).join('L');
  return (
    <div ref={ref} className="ch-spark" style={{ height }} aria-hidden="true">
      {width > 0 && values.length > 0 && (
        <svg width={width} height={height}>
          <path d={`M${d}`} stroke={color} className="ch-spark__line" pathLength="1" />
          <circle cx={px(values.length - 1)} cy={py(values[values.length - 1])} r="3.5" fill={color} className="ch__dot" />
        </svg>
      )}
    </div>
  );
}

/** Chú thích cho biểu đồ đường (đặt phía trên biểu đồ) */
export function Legend({ series = [] }) {
  return (
    <ul className="ch-legend">
      {series.map((s, i) => (
        <li key={s.key}><i className="is-line" style={{ background: s.color || SERIES[i] }} />{s.name}</li>
      ))}
    </ul>
  );
}
