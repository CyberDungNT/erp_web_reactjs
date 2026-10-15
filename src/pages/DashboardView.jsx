import { useCallback, useEffect, useState } from 'react';
import { CyberTable } from '../components/cyber';
import Icon from '../components/icons/Icon';
import { callProc } from '../api/apiClient';

/**
 * Trang dashboard mặc định: gọi CP_name với Para (từ bảng dashboard của CP_SysLogin)
 * rồi hiển thị tất cả các bảng trả về. isRefresh = 1 -> có nút làm mới.
 */
export default function DashboardView({ board }) {
  const [state, setState] = useState({ loading: true, error: null, tables: [], at: null });

  const load = useCallback(async () => {
    if (!board?.CP_name) return setState({ loading: false, error: 'Dashboard chưa khai báo CP_name', tables: [], at: null });
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await callProc(board.CP_name, board.Para || '');
      setState({ loading: false, error: null, tables: res.tables, at: new Date() });
    } catch (err) {
      setState({ loading: false, error: err.message, tables: [], at: null });
    }
  }, [board]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <div className="page__title">
        <h2>{board?.Title}</h2>
        <div className="page__actions">
          {state.at && <span className="cy-muted">Cập nhật {state.at.toLocaleTimeString('vi-VN')}</span>}
          {Number(board?.isRefresh) === 1 && (
            <button type="button" className="cy-btn" onClick={load} disabled={state.loading}>
              <Icon name="refresh" size={14} /> Làm mới
            </button>
          )}
        </div>
      </div>
      <p className="hint">Proc: <code>{board?.CP_name}</code>{board?.Para ? <> · Para: <code>{board.Para}</code></> : null} · Trang: <code>{board?.PageName}</code></p>
      {state.error && <div className="alert alert--error">{state.error}</div>}
      {state.loading && !state.tables.length && <div className="panel"><CyberTable data={[]} loading height={160} /></div>}
      {state.tables.map((t, i) => (
        <section className="panel" key={i}>
          <CyberTable data={t} height={Math.min(420, 44 + t.length * 30)} showSearch={t.length > 10} loading={state.loading} />
        </section>
      ))}
    </div>
  );
}
