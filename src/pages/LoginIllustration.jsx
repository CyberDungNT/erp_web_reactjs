/**
 * Hình minh hoạ isometric (vẽ tay bằng SVG) cho màn đăng nhập:
 * nền tảng trung tâm nối các khối máy chủ, biểu đồ, hồ sơ, laptop, màn hình.
 * Có chuyển động nhẹ: khối máy chủ trôi, đường nối chạy, biểu đồ mọc lên.
 */
const OX = 300;
const OY = 128;
const p = (x, y, z) => `${(OX + (x - y) * 0.866).toFixed(1)},${(OY + (x + y) * 0.5 - z).toFixed(1)}`;
const pts = (...list) => list.map((a) => p(...a)).join(' ');

const BLUE = ['#cfe4f1', '#74b1d8', '#3b86b8'];
const BLUE_D = ['#a9cfe6', '#4a95c6', '#1f6390'];
const LIGHT = ['#ffffff', '#e6f0f6', '#cfe1ec'];
const BASE_Z = 12;

function Box({ x, y, z = BASE_Z, w, d, h, c = BLUE, className, style, children }) {
  return (
    <g className={className} style={style}>
      <polygon points={pts([x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h])} fill={c[1]} />
      <polygon points={pts([x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h])} fill={c[2]} />
      <polygon points={pts([x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h])} fill={c[0]}
        stroke="#ffffff" strokeOpacity=".7" strokeWidth=".8" />
      {children}
    </g>
  );
}

/** Mặt đứng song song trục X (y cố định) */
const panelY = (y, x1, x2, z1, z2) => pts([x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]);

function Path({ points, delay = 0 }) {
  const d = 'M' + points.map(([x, y]) => p(x, y, BASE_Z)).join(' L');
  return (
    <>
      <path d={d} fill="none" stroke="#bcd8e8" strokeWidth="2.2" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#3a8cc0" strokeWidth="2.2" strokeDasharray="6 10" strokeLinecap="round"
        className="illu-flow" style={{ animationDelay: `${delay}s` }} />
      {[points[0], points[points.length - 1]].map(([x, y], i) => {
        const [cx, cy] = p(x, y, BASE_Z).split(',').map(Number);
        return <ellipse key={i} cx={cx} cy={cy} rx="5" ry="2.9" fill="#3a8cc0" />;
      })}
    </>
  );
}

export default function LoginIllustration() {
  // laptop chart (mặt màn hình y=196)
  const chart = [[48, 30], [58, 38], [68, 34], [78, 48], [88, 42], [98, 56], [108, 50], [114, 62]];
  const chartFill = pts([48, 196, 22], ...chart.map(([x, z]) => [x, 196, z]), [114, 196, 22]);
  const chartLine = chart.map(([x, z]) => p(x, 196, z)).join(' ');

  return (
    <svg className="illu" viewBox="0 0 600 450" role="img" aria-label="Minh hoạ hệ thống quản trị doanh nghiệp">
      <defs>
        <radialGradient id="illu-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#123d5c" stopOpacity=".22" />
          <stop offset="1" stopColor="#123d5c" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="300" cy="420" rx="270" ry="38" fill="url(#illu-shadow)" />

      {/* Nền tảng */}
      <Box x={0} y={0} z={0} w={280} h={12} d={280} c={['#f8fbfd', '#e1eef5', '#cde0eb']} />
      <polygon points={pts([14, 14, 12], [266, 14, 12], [266, 266, 12], [14, 266, 12])} fill="none"
        stroke="#d9eaf2" strokeWidth="1.2" strokeDasharray="3 5" />

      {/* Đường nối */}
      <Path points={[[40, 150], [125, 150], [125, 250]]} />
      <Path points={[[150, 100], [150, 125], [255, 125]]} delay={-1.2} />
      <Path points={[[60, 95], [60, 140]]} delay={-.6} />
      <Path points={[[205, 175], [205, 225], [250, 225]]} delay={-1.8} />

      {/* Biểu đồ cột (sau trái) */}
      <g className="illu-grow">
        <Box x={22} y={34} w={15} d={15} h={46} c={BLUE} />
        <Box x={44} y={34} w={15} d={15} h={78} c={BLUE} />
        <Box x={66} y={34} w={15} d={15} h={112} c={BLUE_D} />
      </g>

      {/* Hồ sơ nhân sự (tấm đứng) */}
      <g className="illu-float illu-float--slow">
        <polygon points={panelY(52, 104, 164, 14, 124)} fill="#ffffff" stroke="#5ea3cf" strokeWidth="2.5" strokeLinejoin="round" />
        <polygon points={panelY(52, 122, 146, 118, 130)} fill="#ff990a" />
        <polygon points={panelY(52, 116, 152, 64, 106)} fill="#e8f2f8" />
        <ellipse cx={p(134, 52, 92).split(',')[0]} cy={p(134, 52, 92).split(',')[1]} rx="7" ry="8" fill="#2a77a8" />
        <polygon points={panelY(52, 124, 144, 70, 80)} fill="#2a77a8" />
        {[54, 46, 38, 30].map((z, i) => (
          <polyline key={z} points={`${p(114, 52, z)} ${p(i % 2 ? 140 : 156, 52, z)}`} stroke="#a7c9de" strokeWidth="2.4" strokeLinecap="round" />
        ))}
      </g>

      {/* Cụm máy chủ */}
      <g className="illu-float">
        <Box x={180} y={36} w={58} d={58} h={22} c={BLUE} />
        <Box x={180} y={36} z={40} w={58} d={58} h={22} c={BLUE} />
        <Box x={180} y={36} z={68} w={58} d={58} h={22} c={BLUE_D} />
        <polygon points={pts([192, 48, 90], [226, 48, 90], [226, 82, 90], [192, 82, 90])} fill="none" stroke="#ffffff" strokeWidth="1.6" />
        <polygon points={pts([200, 56, 90], [218, 56, 90], [218, 74, 90], [200, 74, 90])} fill="#ffffff" opacity=".55" />
        {[20, 48, 76].map((z) => (
          <polyline key={z} points={`${p(188, 94, z)} ${p(206, 94, z)}`} stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity=".85" />
        ))}
      </g>

      {/* Khối nhỏ trái */}
      <Box x={14} y={118} w={42} d={42} h={28} c={LIGHT}>
        <polygon points={pts([22, 126, 40], [48, 126, 40], [48, 152, 40], [22, 152, 40])} fill="#5ea3cf" />
        <polygon points={pts([28, 133, 40], [42, 133, 40], [35, 145, 40])} fill="#ffffff" />
      </Box>

      {/* Khối nhỏ phải */}
      <Box x={234} y={150} w={38} d={38} h={22} c={LIGHT} className="illu-float illu-float--fast">
        <polygon points={pts([241, 157, 34], [265, 157, 34], [265, 181, 34], [241, 181, 34])} fill="#cfe4f1" />
        <polygon points={pts([247, 163, 34], [259, 163, 34], [259, 175, 34], [247, 175, 34])} fill="#ffffff" />
      </Box>

      {/* Màn hình ứng dụng */}
      <g className="illu-float illu-float--slow">
        <polygon points={panelY(160, 168, 246, 12, 104)} fill="#4d97c8" />
        <polygon points={panelY(160, 173, 241, 18, 96)} fill="#ffffff" />
        <polygon points={panelY(160, 178, 200, 46, 86)} fill="#e4f0f7" />
        <polygon points={panelY(160, 206, 236, 76, 86)} fill="#cfe4f1" />
        <polygon points={panelY(160, 206, 236, 60, 70)} fill="#e4f0f7" />
        <polygon points={panelY(160, 206, 226, 46, 54)} fill="#e4f0f7" />
        <polygon points={panelY(160, 178, 236, 26, 38)} fill="#f1f7fa" />
        {/* bong bóng chat cam */}
        <polygon points={panelY(156, 154, 172, 80, 96)} fill="#ff990a" />
        <polygon points={panelY(156, 158, 168, 86, 90)} fill="#ffffff" />
      </g>

      {/* Laptop */}
      <g>
        <Box x={40} y={196} w={84} d={58} h={6} c={['#f2f6f9', '#d6e3eb', '#c3d3dd']} />
        <polygon points={panelY(196, 40, 122, 18, 82)} fill="#21334a" />
        <polygon points={panelY(196, 44, 118, 22, 78)} fill="#ffffff" />
        <polygon points={chartFill} fill="#ffd49a" opacity=".85" className="illu-chart" />
        <polyline points={chartLine} fill="none" stroke="#ff990a" strokeWidth="2.4" strokeLinejoin="round" className="illu-chart" />
      </g>

      {/* Biểu đồ cột trước */}
      <g className="illu-grow illu-grow--late">
        <Box x={140} y={190} w={13} d={13} h={58} c={BLUE} />
        <Box x={158} y={190} w={13} d={13} h={38} c={BLUE} />
        <Box x={176} y={190} w={13} d={13} h={24} c={BLUE} />
      </g>

      {/* Khối trước */}
      <Box x={150} y={236} w={38} d={38} h={26} c={LIGHT}>
        <polygon points={pts([157, 243, 38], [181, 243, 38], [181, 267, 38], [157, 267, 38])} fill="#5ea3cf" />
        <polygon points={pts([163, 250, 38], [175, 250, 38], [169, 261, 38])} fill="#ffffff" />
      </Box>
    </svg>
  );
}
