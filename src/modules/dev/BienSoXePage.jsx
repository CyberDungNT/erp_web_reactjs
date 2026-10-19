import { useEffect, useRef, useState } from 'react';
import { CyberPopup, toast } from '@/components/cyber';
import CyberPlateReader, { listCameras, DEFAULT_RELAY } from '@/components/plate/CyberPlateReader';

/**
 * MÀN MẪU: ĐỌC BIỂN SỐ XE TỪ CAMERA (control CyberPlateReader – src/components/plate)
 *
 * Nguồn hình:
 *   - Webcam của máy
 *   - Link camera IP rtsp:// – qua go2rtc chạy trên CHÍNH MÁY NÀY (không qua backend) – cài đặt: tools/go2rtc/README.md
 *   - Link ảnh chụp / MJPEG / video mp4 (camera phải cho phép CORS)
 *   - Ảnh tải lên (thử nhanh khi chưa có camera) + nút "Tạo ảnh mẫu"
 *
 * Dùng vào nghiệp vụ (vd cổng xe ra vào): xử lý trong onRead – gọi proc lưu biển số, ảnh chụp, giờ vào/ra...
 */
const SOURCES = [
  { key: 'url', text: 'Link camera' },
  { key: 'webcam', text: 'Webcam' },
  { key: 'image', text: 'Ảnh tải lên' },
];

export default function BienSoXePage() {
  const [kind, setKind] = useState('url');
  const [url, setUrl] = useState('');
  const [relay, setRelay] = useState(DEFAULT_RELAY); // go2rtc trên máy này (chỉ dùng với link rtsp)
  const [refreshMs, setRefreshMs] = useState(300);
  const [cameras, setCameras] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [imageSrc, setImageSrc] = useState('');
  const [source, setSource] = useState(null);       // nguồn đang chạy (chỉ đổi khi bấm Kết nối / chọn ảnh)
  const [auto, setAuto] = useState(false);
  const [interval, setIntervalMs] = useState(1200);
  const [history, setHistory] = useState([]);
  const [viewing, setViewing] = useState(null);     // biển đang xem ảnh lớn
  const fileRef = useRef(null);

  const isRtsp = /^rtsp:/i.test(url.trim());

  // Webcam: hỏi quyền rồi lấy danh sách camera
  useEffect(() => {
    if (kind !== 'webcam') return;
    setSource({ type: 'webcam', deviceId: deviceId || undefined });
    const t = setTimeout(() => listCameras().then(setCameras).catch(() => {}), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, deviceId]);

  useEffect(() => {
    if (kind === 'image') setSource(imageSrc ? { type: 'image', src: imageSrc } : null);
    if (kind === 'url') setSource(null);
  }, [kind, imageSrc]);

  const connect = (e) => {
    e?.preventDefault();
    if (!url.trim()) { toast.warning('Nhập link camera trước.'); return; }
    setSource({ type: 'url', url: url.trim(), relay, refreshMs });
  };

  const pickFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.warning('Chọn file ảnh (jpg, png...).'); return; }
    if (imageSrc.startsWith('blob:')) URL.revokeObjectURL(imageSrc);
    setImageSrc(URL.createObjectURL(file));
  };

  const onRead = (r) => {
    setHistory((h) => [{ id: `${r.compact}-${r.at.getTime()}`, ...r }, ...h].slice(0, 50));
    if (auto) toast.success(`Nhận biển số ${r.plate}`, { title: 'Xe vào', duration: 2500 });
  };

  return (
    <div className="page bsx">
      <div className="page__title">
        <h2>Đọc biển số xe</h2>
        <span className="hint" style={{ margin: 0 }}>Nhận dạng ngay trên trình duyệt · đọc toàn khung hình (bấm "Chọn vùng" để khoanh vùng nhỏ)</span>
      </div>

      <div className="split bsx__split">
        <div>
          <div className="panel">
            <h3 className="panel__title">Nguồn camera</h3>
            <div className="bsx__tabs" role="tablist">
              {SOURCES.map((s) => (
                <button key={s.key} type="button" role="tab" aria-selected={kind === s.key}
                  className={kind === s.key ? 'is-on' : ''} onClick={() => setKind(s.key)}>{s.text}</button>
              ))}
            </div>

            {kind === 'url' && (
              <form className="bsx__row" onSubmit={connect}>
                <input className="cy-input bsx__url" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="rtsp://user:pass@ip:554/Streaming/Channels/101  ·  http://ip/snapshot.jpg" />
                {isRtsp && (
                  <label className="bsx__check" title="go2rtc chạy trên máy này đổi rtsp thành ảnh cho trình duyệt – tools/go2rtc/README.md">
                    go2rtc
                    <input className="cy-input bsx__relay" value={relay} onChange={(e) => setRelay(e.target.value)} />
                  </label>
                )}
                <label className="bsx__check">
                  Tải ảnh mỗi
                  <input className="cy-input bsx__num" type="number" min={100} step={100} value={refreshMs}
                    onChange={(e) => setRefreshMs(Math.max(100, +e.target.value || 300))} /> ms
                </label>
                <button type="submit" className="cy-btn cy-btn--primary">Kết nối</button>
              </form>
            )}

            {kind === 'webcam' && (
              <div className="bsx__row">
                <select className="cy-input bsx__url" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                  <option value="">Camera mặc định (camera sau trên điện thoại)</option>
                  {cameras.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {kind === 'image' && (
              <div className="bsx__row">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" className="cy-btn" onClick={() => fileRef.current?.click()}>Chọn ảnh...</button>
                <button type="button" className="cy-btn" onClick={() => setImageSrc(makeSampleImage())}>Tạo ảnh mẫu</button>
                <span className="hint" style={{ margin: 0 }}>hoặc kéo thả ảnh vào khung bên dưới</span>
              </div>
            )}

            <div className="bsx__row">
              <label className="bsx__check">
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                Tự đọc liên tục
              </label>
              <label className="bsx__check">
                mỗi
                <input className="cy-input bsx__num" type="number" min={400} step={100} value={interval}
                  onChange={(e) => setIntervalMs(Math.max(400, +e.target.value || 1200))} /> ms
              </label>
            </div>
          </div>

          <div className="panel" onDragOver={(e) => { if (kind === 'image') e.preventDefault(); }}
            onDrop={(e) => { if (kind !== 'image') return; e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}>
            <CyberPlateReader source={source} auto={auto} interval={interval} onRead={onRead} />
          </div>
        </div>

        <div className="panel bsx__history">
          <h3 className="panel__title">
            Biển số đã đọc
            {history.length > 0 && <button type="button" className="cy-btn bsx__clear" onClick={() => setHistory([])}>Xoá</button>}
          </h3>
          {!history.length && <p className="hint">Chưa có. Bấm "Đọc biển số" hoặc bật "Tự đọc liên tục".</p>}
          <ul className="bsx__list">
            {history.map((h, i) => (
              <li key={h.id}>
                {/* Mỗi biển đọc được: ảnh biển chụp được + chữ biển số; bấm để xem ảnh lớn */}
                <button type="button" className={`bsx__card ${i === 0 ? 'is-new' : ''}`} onClick={() => setViewing(h)} title="Bấm để xem ảnh lớn">
                  <span className="bsx__shot"><img src={h.snapshot} alt={`Ảnh biển số ${h.plate}`} /></span>
                  <span className="bsx__plate">{h.plate}</span>
                  <span className="bsx__meta">
                    {h.at.toLocaleTimeString('vi-VN')}
                    {h.confidence != null && <i>tin cậy {h.confidence}%</i>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Xem ảnh lớn 1 biển đã đọc: ảnh biển + ảnh cả khung hình lúc đọc */}
      <CyberPopup open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Biển số ${viewing.plate}` : ''} width={760}>
        {viewing && (
          <div className="bsx__view">
            <div className="bsx__view-plate">
              <img src={viewing.snapshot} alt={`Ảnh biển số ${viewing.plate}`} />
              <div>
                <b>{viewing.plate}</b>
                <small>{viewing.at.toLocaleString('vi-VN')}{viewing.confidence != null && ` · tin cậy ${viewing.confidence}%`}</small>
              </div>
            </div>
            {viewing.frame && <img className="bsx__view-frame" src={viewing.frame} alt="Ảnh cả khung hình lúc đọc" />}
          </div>
        )}
      </CyberPopup>
    </div>
  );
}

/** Vẽ 1 ảnh giả lập camera cổng: nền xe + biển số trắng (ô tô) để thử khi chưa có camera */
function makeSampleImage() {
  const plates = ['30A-123.45', '51F-678.90', '29C-246.81', '43A-579.13', '88A-120.45'];
  const text = plates[Math.floor(Math.random() * plates.length)];
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 720);
  bg.addColorStop(0, '#3a4452'); bg.addColorStop(1, '#1d232c');
  g.fillStyle = bg; g.fillRect(0, 0, 1280, 720);
  // thân xe
  g.fillStyle = '#8c96a5'; g.beginPath(); g.roundRect(240, 220, 800, 420, 60); g.fill();
  g.fillStyle = '#2c3440'; g.fillRect(330, 260, 620, 120);                      // kính
  g.fillStyle = '#e8edf3'; g.beginPath(); g.ellipse(330, 470, 60, 30, 0, 0, 7); g.ellipse(950, 470, 60, 30, 0, 0, 7); g.fill(); // đèn
  // biển số
  g.fillStyle = '#f7f7f2'; g.beginPath(); g.roundRect(440, 440, 400, 96, 8); g.fill();
  g.lineWidth = 6; g.strokeStyle = '#111'; g.stroke();
  g.fillStyle = '#111'; g.font = 'bold 70px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 640, 490);
  return c.toDataURL('image/jpeg', 0.92);
}
