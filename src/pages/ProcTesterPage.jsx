import { useState } from 'react';
import { CyberTextBox, CyberTable } from '../components/cyber';
import { useCyberForm } from '../hooks/useCyberForm';
import { callProc, apiConfig } from '../api/apiClient';

/** Gọi bất kỳ proc nào trên server và hiển thị tất cả bảng trả về. */
export default function ProcTesterPage() {
  const form = useCyberForm({ Name: 'Demo_GetHangHoa', Para: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ms, setMs] = useState(0);

  const run = async () => {
    setLoading(true);
    setError(null);
    const t = performance.now();
    try {
      setResult(await callProc(form.data.Name, form.data.Para));
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setMs(Math.round(performance.now() - t));
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page__title"><h2>Gọi proc tuỳ ý</h2></div>
      <section className="panel">
        <p className="hint">
          POST <code>{apiConfig.EXECUTE_URL}</code> · {apiConfig.USE_MOCK ? 'đang dùng dữ liệu giả' : 'gọi server thật'}
        </p>
        <div className="grid grid--2">
          <CyberTextBox {...form.bind('Name')} label="Tên proc (Name)" onEnter={run} />
          <CyberTextBox {...form.bind('Para')} label="Tham số (Para)" placeholder="vd: 1#2" onEnter={run} />
        </div>
        <button className="cy-btn cy-btn--primary" onClick={run} disabled={loading || !form.data.Name}>
          {loading ? 'Đang gọi...' : '▶ Thực thi'}
        </button>
      </section>

      {error && <div className="alert alert--error">{error}</div>}
      {result && (
        <>
          <div className="alert alert--ok">{result.message} · {result.tables.length} bảng · {ms} ms</div>
          {result.tables.map((t, i) => (
            <section className="panel" key={i}>
              <h3 className="panel__title">Bảng {i} ({t.length} dòng)</h3>
              <CyberTable data={t} height={Math.min(360, 40 + t.length * 30)} showSearch={t.length > 10} />
            </section>
          ))}
          <section className="panel">
            <h3 className="panel__title">JSON gốc</h3>
            <pre className="json-view">{JSON.stringify(result.raw, null, 2)}</pre>
          </section>
        </>
      )}
    </div>
  );
}
