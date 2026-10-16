import { useRef, useState } from 'react';
import { CyberForm } from '../components/cyber';
import { normalizeTables } from '../api/apiClient';
import { mockDashboardHome } from '../api/mockDashboard';
import { BarList, Legend, LineChart, SERIES, Sparkline, StackBar, fmtCompact } from '../components/charts/Charts';
import './dashboard.css';

/**
 * TRANG CHỦ – DASHBOARD BIỂU ĐỒ (thay cho hàng tab dashboard cũ).
 * Dữ liệu: proc DASHBOARD_PROC @SoThang trả về
 *   T0: KPI          { Ma, Ten, GiaTri, KyTruoc, Kieu: 'money'|'number', Cot (cột ở T1 vẽ sparkline), NguocChieu (1 = tăng là xấu) }
 *   T1: theo tháng   { Thang, NamNay, NamTruoc, DonHang, KhachMoi, TonKho }
 *   T2: chi nhánh    { Ten, DoanhThu }
 *   T3: nhóm hàng    { Nhom, DoanhThu }
 *   T4: top hàng     { MaHang, TenHang, SoLuong, DoanhThu }
 * Đổi tên proc / cột ở đây khi nối backend thật.
 */
const DASHBOARD_PROC = 'CP_DashboardHome';

/**
 * true  -> luôn hiển thị DỮ LIỆU GIẢ (api/mockDashboard.js), không gọi server – kể cả khi VITE_USE_MOCK=false.
 * false -> gọi proc thật DASHBOARD_PROC (khi backend đã có proc).
 */
const USE_FAKE_DATA = true;

const RANGES = [
  { value: 3, V: '3 tháng', E: '3 months' },
  { value: 6, V: '6 tháng', E: '6 months' },
  { value: 12, V: '12 tháng', E: '12 months' },
];

const T = {
  V: {
    title: 'Tổng quan kinh doanh', sub: 'Số liệu cập nhật khi mở trang · F5 để làm mới', range: 'Khoảng thời gian',
    revenue: 'Doanh thu theo tháng', thisYear: 'Năm nay', lastYear: 'Cùng kỳ năm trước', table: 'Xem dạng bảng', chart: 'Xem biểu đồ',
    month: 'Tháng', branch: 'Doanh thu theo chi nhánh', mix: 'Cơ cấu doanh thu theo nhóm hàng', top: 'Top hàng bán chạy',
    item: 'Hàng hoá', qty: 'Số lượng', amount: 'Doanh thu', vsPrev: 'so với tháng trước', total: 'Tổng',
  },
  E: {
    title: 'Business overview', sub: 'Loaded when the page opens · F5 to refresh', range: 'Time range',
    revenue: 'Monthly revenue', thisYear: 'This year', lastYear: 'Same period last year', table: 'Show table', chart: 'Show chart',
    month: 'Month', branch: 'Revenue by branch', mix: 'Revenue mix by category', top: 'Top selling items',
    item: 'Item', qty: 'Quantity', amount: 'Revenue', vsPrev: 'vs last month', total: 'Total',
  },
};

const fmtMoney = (v) => fmtCompact(v);
const fmtFull = (v) => `${Number(v || 0).toLocaleString('vi-VN')} đ`;

export default function HomeDashboard({ board }) {
  const [showTable, setShowTable] = useState(false);
  const monthsRef = useRef(12); // khoảng thời gian đang chọn (ref để onLoad luôn đọc giá trị mới nhất)

  const onLoad = async (f) => {
    const months = monthsRef.current;
    let tables;
    if (USE_FAKE_DATA) {
      await new Promise((r) => setTimeout(r, 300)); // giả lập độ trễ để thấy hiệu ứng tải
      tables = normalizeTables(mockDashboardHome([String(months)]));
    } else {
      tables = (await f.call(DASHBOARD_PROC, [months])).tables;
    }
    const [kpi = [], byMonth = [], byBranch = [], byGroup = [], top = []] = tables;
    f.setVars({ months, kpi, byMonth, byBranch, byGroup, top });
  };

  return (
    <CyberForm headless onLoad={onLoad} className="dash">
      {(f) => {
        const t = T[f.lang === 'E' ? 'E' : 'V'];
        const { kpi = [], byMonth = [], byBranch = [], byGroup = [], top = [], months = 12 } = f.vars;
        const series = [
          { key: 'NamNay', name: t.thisYear, color: SERIES[0] },
          { key: 'NamTruoc', name: t.lastYear, color: SERIES[1] },
        ];
        const setRange = (v) => { if (v !== months) { monthsRef.current = v; f.reload(); } };

        return (
          <div className="dash__wrap1">
            <div className="dash__head">
              <div>
                <h1 className="dash__title">{t.title}</h1>
                <p className="dash__sub">{board?.Title ? `${board.Title} · ` : ''}{t.sub}</p>
              </div>
              {/* Bộ lọc: 1 hàng phía trên, áp cho toàn bộ biểu đồ */}
              <div className="dash__filter" role="radiogroup" aria-label={t.range}>
                {RANGES.map((r) => (
                  <button key={r.value} type="button" role="radio" aria-checked={months === r.value}
                    className={months === r.value ? 'is-on' : ''} onClick={() => setRange(r.value)}>
                    {r[f.lang === 'E' ? 'E' : 'V']}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI */}
            <div className="dash__kpis">
              {kpi.map((k, i) => {
                const delta = k.KyTruoc ? ((k.GiaTri - k.KyTruoc) / k.KyTruoc) * 100 : 0;
                const up = delta >= 0;
                const good = k.NguocChieu ? !up : up;
                return (
                  <div key={k.Ma} className="dash__kpi" style={{ '--i': i }}>
                    <span className="dash__kpi-name">{k.Ten}</span>
                    <b className="dash__kpi-value" title={k.Kieu === 'money' ? fmtFull(k.GiaTri) : undefined}>
                      {k.Kieu === 'money' ? fmtMoney(k.GiaTri) : Number(k.GiaTri).toLocaleString('vi-VN')}
                    </b>
                    <span className={`dash__delta ${good ? 'is-good' : 'is-bad'}`}>
                      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {Math.abs(delta).toFixed(1)}%
                      <span className="dash__delta-note"> {t.vsPrev}</span>
                    </span>
                    <Sparkline values={byMonth.map((m) => Number(m[k.Cot]) || 0)} />
                  </div>
                );
              })}
            </div>

            <div className="dash__grid">
              {/* Doanh thu theo tháng */}
              <section className="dash__card dash__card--wide">
                <div className="dash__card-head">
                  <h2>{t.revenue}</h2>
                  <Legend series={series} />
                  <button type="button" className="dash__link" onClick={() => setShowTable((v) => !v)}>
                    {showTable ? t.chart : t.table}
                  </button>
                </div>
                {showTable ? (
                  <div className="dash__table-wrap">
                    <table className="dash__table">
                      <thead><tr><th>{t.month}</th><th>{t.thisYear}</th><th>{t.lastYear}</th></tr></thead>
                      <tbody>
                        {byMonth.map((m) => (
                          <tr key={m.Thang}><td>{m.Thang}</td><td>{fmtFull(m.NamNay)}</td><td>{fmtFull(m.NamTruoc)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <LineChart data={byMonth} x="Thang" series={series} height={290} format={fmtMoney} ariaLabel={t.revenue} />
                )}
              </section>

              {/* Theo chi nhánh */}
              <section className="dash__card">
                <div className="dash__card-head"><h2>{t.branch}</h2></div>
                <BarList data={byBranch} label="Ten" value="DoanhThu" format={fmtMoney} />
              </section>

              {/* Cơ cấu nhóm hàng */}
              <section className="dash__card">
                <div className="dash__card-head"><h2>{t.mix}</h2></div>
                <StackBar data={byGroup} label="Nhom" value="DoanhThu" format={fmtMoney} />
              </section>

              {/* Top hàng */}
              <section className="dash__card dash__card--wide">
                <div className="dash__card-head"><h2>{t.top}</h2></div>
                <div className="dash__table-wrap">
                  <table className="dash__table dash__table--rank">
                    <thead><tr><th>#</th><th>{t.item}</th><th>{t.qty}</th><th>{t.amount}</th><th aria-hidden="true" /></tr></thead>
                    <tbody>
                      {top.map((r, i) => (
                        <tr key={r.MaHang} style={{ '--i': i }}>
                          <td><span className="dash__rank">{i + 1}</span></td>
                          <td><b>{r.TenHang}</b><small>{r.MaHang}</small></td>
                          <td>{Number(r.SoLuong).toLocaleString('vi-VN')}</td>
                          <td>{fmtFull(r.DoanhThu)}</td>
                          <td className="dash__meter-cell">
                            <span className="dash__meter"><span style={{ width: `${(r.DoanhThu / (top[0]?.DoanhThu || 1)) * 100}%` }} /></span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        );
      }}
    </CyberForm>
  );
}
