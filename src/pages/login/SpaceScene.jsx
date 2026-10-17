/**
 * Khung cảnh không gian ở panel trái màn login: sao lấp lánh, sao băng, quả địa cầu xoay + các quỹ đạo vệ tinh 3D.
 * Chỉ để trang trí (aria-hidden). Chỉnh số lượng / màu ở các mảng bên dưới; hiệu ứng ở login.css (.sp__*).
 */

// [trái %, trên %, trễ giây]
const STARS = [
  [12, 18, 0], [34, 9, 1.1], [61, 14, 2.3], [82, 26, 0.6], [72, 44, 1.8], [91, 8, 2.7],
  [48, 31, 0.3], [6, 72, 1.4], [22, 88, 2.1], [55, 64, 0.9], [40, 52, 2.9], [88, 58, 1.6],
];

// [trái %, trên %, dài px, thời gian chu kỳ giây, trễ giây]
const METEORS = [
  [92, 4, 170, 7, 0.4], [70, -2, 120, 8.5, 1.6], [104, 18, 200, 6.5, 2.4], [55, 6, 110, 9, 3.1],
  [98, 34, 150, 7.5, 4.2], [80, 10, 140, 6, 5], [110, 2, 220, 10, 5.8], [64, 22, 100, 8, 6.7],
  [88, 46, 130, 9.5, 7.4], [46, -4, 160, 7, 8.3], [101, 26, 180, 8, 9.1], [76, 30, 90, 6.8, 10],
  [60, 40, 120, 11, 0.9], [84, -6, 190, 9, 3.7],
];

const TEAL = '#5EEAD4';
const BLUE = '#8EA8FF';
const VIOLET = '#C4B5FD';
const AMBER = '#F5A524';
const GOLD = '#FCD34D';

// Vật thể trên quỹ đạo: dot = chấm sáng [màu, kích thước], sat = vệ tinh có 2 tấm pin [màu tấm pin]
const dot = (color, size) => ({ kind: 'dot', color, size });
const sat = (color = BLUE) => ({ kind: 'sat', color });

/**
 * Quỹ đạo: size = đường kính, tilt = góc nghiêng (rotateX, rotateY), dur = giây / vòng, rev = quay ngược,
 * items = [vật thể, độ lệch pha 0..1]. front = vẽ sau quả địa cầu (nằm phía trước).
 */
const ORBITS = [
  { size: 600, rx: 70, ry: -6, dur: 38, border: '1px dashed rgba(255,255,255,.14)',
    items: [[dot(TEAL, 6), 0], [sat(TEAL), 0.25], [dot(BLUE, 5), 0.75], [dot('#FFFFFF', 4), 0.5]] },
  { size: 400, rx: 74, ry: -40, dur: 16, border: '1px solid rgba(94,234,212,.22)',
    items: [[sat(TEAL), 0], [dot(TEAL, 6), 0.33], [dot('#FFFFFF', 4), 0.66]] },
  { size: 540, rx: 66, ry: 44, dur: 28, rev: true, border: '1px dashed rgba(196,181,253,.22)',
    items: [[sat(VIOLET), 0], [dot(VIOLET, 6), 0.25], [dot('#FFFFFF', 4), 0.5], [dot(AMBER, 7), 0.75]] },
  { size: 340, rx: 72, ry: -16, dur: 12, front: true, border: '1px solid rgba(142,168,255,.35)',
    items: [[dot('#FFFFFF', 5), 0.33], [sat(), 0.66], [sat(), 0]] },
  { size: 460, rx: 68, ry: 20, dur: 20, rev: true, front: true, border: '1px solid rgba(245,165,36,.28)',
    items: [[dot(AMBER, 9), 0], [dot('#FFFFFF', 5), 0.7], [sat(GOLD), 0.4]] },
];

function Orbit({ o }) {
  return (
    <div className="sp__orbit" style={{
      width: o.size, height: o.size, margin: `${-o.size / 2}px 0 0 ${-o.size / 2}px`, border: o.border,
      transform: `rotateX(${o.rx}deg) rotateY(${o.ry}deg)`,
    }}>
      {o.items.map(([it, phase], i) => (
        <div key={i} className={`sp__arm ${o.rev ? 'is-rev' : ''}`}
          style={{ animationDuration: `${o.dur}s`, animationDelay: `${-phase * o.dur}s` }}>
          <div className="sp__sat">
            {it.kind === 'dot' ? (
              <div className="sp__dot" style={{
                width: it.size, height: it.size, background: it.color,
                boxShadow: `0 0 ${it.size + 4}px ${it.size > 6 ? 3 : 2}px ${it.color}b3`,
              }} />
            ) : (
              <div className="sp__body" style={{ '--pc': it.color }}>
                <span className="sp__panel" /><span className="sp__core" /><span className="sp__panel" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SpaceScene() {
  return (
    <>
      <div className="sp__sky" aria-hidden="true">
        {STARS.map(([l, t, d], i) => (
          <span key={i} className="sp__star" style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${d}s` }} />
        ))}
        {METEORS.map(([l, t, w, dur, d], i) => (
          <span key={i} className="sp__meteor"
            style={{ left: `${l}%`, top: `${t}%`, width: w, animationDuration: `${dur}s`, animationDelay: `${d}s` }} />
        ))}
      </div>

      <div className="sp__scene" aria-hidden="true">
        <div className="sp__glow" />
        <div className="sp__ping" />
        <div className="sp__ping" style={{ animationDelay: '2.25s' }} />
        {ORBITS.filter((o) => !o.front).map((o, i) => <Orbit key={i} o={o} />)}
        <div className="sp__globe">
          <svg className="sp__meridians" viewBox="0 0 480 240" preserveAspectRatio="none">
            <g fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1">
              {[0, 60, 120, 180, 240, 300, 360, 420, 480].map((cx) => <ellipse key={cx} cx={cx} cy="120" rx="60" ry="120" />)}
            </g>
            <g fill="rgba(255,255,255,.10)">
              <path d="M30 70 q30 -20 60 -6 q18 14 4 34 q-26 20 -54 6 q-22 -14 -10 -34z" />
              <path d="M150 130 q24 -10 40 8 q10 24 -14 40 q-24 8 -34 -12 q-6 -22 8 -36z" />
              <path d="M270 70 q30 -20 60 -6 q18 14 4 34 q-26 20 -54 6 q-22 -14 -10 -34z" />
              <path d="M390 130 q24 -10 40 8 q10 24 -14 40 q-24 8 -34 -12 q-6 -22 8 -36z" />
            </g>
            <g fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1">
              <path d="M0 60 H480" /><path d="M0 120 H480" /><path d="M0 180 H480" />
            </g>
          </svg>
          <div className="sp__shade" />
        </div>
        {ORBITS.filter((o) => o.front).map((o, i) => <Orbit key={i} o={o} />)}
      </div>
    </>
  );
}
