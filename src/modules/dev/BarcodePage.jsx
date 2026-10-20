import { useState } from 'react';
import { toast } from '@/components/cyber';
import Icon from '@/components/icons/Icon';
import { useCyberForm } from '@/hooks/useCyberForm';
import CyberBarcodeScanner from '@/components/barcode/CyberBarcodeScanner';
import CyberBarcodeInput from '@/components/barcode/CyberBarcodeInput';
import '@/components/barcode/barcode.css';

/**
 * MÀN MẪU – QUÉT QR CODE / MÃ VẠCH (camera hoặc hình ảnh)
 *   - CyberBarcodeScanner: khung quét liên tục, mỗi mã đọc được thêm vào danh sách bên phải
 *   - CyberBarcodeInput  : ô nhập có nút quét (quét 1 lần -> điền vào ô) – dùng trong form nghiệp vụ (mã hàng, số serial...)
 */
const isUrl = (t) => /^https?:\/\/\S+$/i.test(t);

export default function BarcodePage() {
  const [items, setItems] = useState([]);
  const form = useCyberForm({ Ma_Vt: '', So_Serial: '' }, { draft: false });

  const onDetect = (r) => setItems((list) => [{ id: `${r.at.getTime()}-${Math.random()}`, ...r }, ...list].slice(0, 100));
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast.success('Đã sao chép.', { duration: 1500 }); }
    catch { toast.warning('Không sao chép được – trình duyệt chặn quyền clipboard.'); }
  };

  return (
    <div className="page bcp">
      <div className="bcp__main">
        <section className="panel">
          <h3 className="panel__title">Quét QR code / mã vạch</h3>
          <CyberBarcodeScanner onDetect={onDetect} height={380} />
          <p className="hint">Camera: đưa mã vào giữa khung (quét liên tục, cùng 1 mã chỉ ghi 1 lần trong 2,5 giây). Hình ảnh: chọn / kéo thả / dán (Ctrl+V) ảnh có mã.
            Hỗ trợ QR, Code 128 / 39 / 93, EAN-13 / 8, UPC, ITF, Codabar, DataMatrix, PDF417, Aztec.</p>
        </section>
        <section className="panel">
          <h3 className="panel__title">Ô nhập có nút quét (CyberBarcodeInput)</h3>
          <div className="grid grid--2">
            <CyberBarcodeInput {...form.bind('Ma_Vt')} label="Mã hàng" placeholder="Gõ / quét mã vạch" upperCase
              onScan={(text) => toast.info(`Đã quét mã hàng: ${text}`)} />
            <CyberBarcodeInput {...form.bind('So_Serial')} label="Số serial" placeholder="Quét QR" formats={['qr_code']} scanTitle="Quét QR số serial" />
          </div>
          <p className="hint">form.data: <code>{JSON.stringify(form.data)}</code></p>
        </section>
      </div>

      <section className="panel bcp__list">
        <h3 className="panel__title bcp__listhead">
          Mã đã đọc <span className="bcp__count">{items.length}</span>
          {items.length > 0 && <button type="button" className="cy-btn bcp__clear" onClick={() => setItems([])}>Xoá danh sách</button>}
        </h3>
        {!items.length ? <p className="hint">Chưa đọc được mã nào.</p> : (
          <ul className="bcp__items">
            {items.map((it) => (
              <li key={it.id} className="bcp__item">
                {it.image && <img src={it.image} alt="" className="bcp__thumb" />}
                <div className="bcp__body">
                  <div className="bcp__text" title={it.text}>
                    {isUrl(it.text) ? <a href={it.text} target="_blank" rel="noopener noreferrer">{it.text}</a> : it.text}
                  </div>
                  <small>
                    <span className="bcp__fmt">{it.formatName}</span>
                    <Icon name={it.source === 'camera' ? 'camera' : 'image'} size={12} /> {it.source === 'camera' ? 'Camera' : 'Ảnh'} · {it.at.toLocaleTimeString('vi-VN')}
                  </small>
                </div>
                <button type="button" className="cy-btn-icon" title="Sao chép" onClick={() => copy(it.text)}><Icon name="file" size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
