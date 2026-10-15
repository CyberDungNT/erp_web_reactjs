import { useEffect, useState } from 'react';
import { CyberTable } from '../components/cyber';
import Icon from '../components/icons/Icon';
import { useAuth } from '../auth/AuthContext';
import { callProc } from '../api/apiClient';

/**
 * Trang chủ: thông tin phiên + các dashboard lấy từ bảng có cột PageName / CP_name / Para / Title.
 * Bấm vào dashboard -> gọi CP_name với Para và hiển thị kết quả.
 */
export default function HomePage() {
  const { user, session } = useAuth();
  const boards = (session?.dashboards || []).filter((d) => d.CP_name && d.Title !== 'HOME');
  const [active, setActive] = useState(boards[0] || null);
  const [state, setState] = useState({ loading: false, error: null, tables: [] });

  const load = async (board) => {
    if (!board) return;
    setState({ loading: true, error: null, tables: [] });
    try {
      const res = await callProc(board.CP_name, board.Para || '');
      setState({ loading: false, error: null, tables: res.tables });
    } catch (err) {
      setState({ loading: false, error: err.message, tables: [] });
    }
  };

  useEffect(() => {
    load(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <div className="page home">
      <section className="home__hero">
        <div>
          <h2>{greet}, {user?.Comment || user?.User_name}</h2>
          <p>{user?.Ten_Dvcs} · {user?.Ten_TTCP}</p>
        </div>
        <dl className="home__facts">
          <div><dt>Đơn vị</dt><dd>{user?.Ma_Dvcs} / {user?.Ma_TTCP}</dd></div>
          <div><dt>Ngày khoá sổ</dt><dd>{user?.Ngay_Ks || '—'}</dd></div>
          <div><dt>Phiên bản</dt><dd>{user?.Version || '—'}</dd></div>
        </dl>
      </section>

      {boards.length > 0 && (
        <section className="panel">
          <div className="home__boards">
            {boards.map((b, i) => (
              <button key={i} type="button"
                className={`home__board ${active === b ? 'is-active' : ''}`}
                onClick={() => (active === b ? load(b) : setActive(b))}>
                <Icon name="dashboard" size={16} />
                {b.Title}
              </button>
            ))}
            {active && Number(active.isRefresh) === 1 && (
              <button type="button" className="cy-btn home__refresh" onClick={() => load(active)} disabled={state.loading}>
                <Icon name="refresh" size={14} /> Làm mới
              </button>
            )}
          </div>
          {active && <p className="hint">Proc: <code>{active.CP_name}</code>{active.Para ? <> · Para: <code>{active.Para}</code></> : null} · Trang: <code>{active.PageName}</code></p>}
          {state.error && <div className="alert alert--error">{state.error}</div>}
          {(state.loading || state.tables.length === 0) && !state.error && (
            <CyberTable data={[]} loading={state.loading} height={160} />
          )}
          {state.tables.map((t, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <CyberTable data={t} height={Math.min(360, 44 + t.length * 30)} showSearch={t.length > 10} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
