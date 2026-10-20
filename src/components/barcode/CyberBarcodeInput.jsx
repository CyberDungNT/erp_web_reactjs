import { lazy, Suspense, useState } from 'react';
import { CyberPopup, CyberTextBox } from '@/components/cyber';
import Icon from '@/components/icons/Icon';
import { useBinding } from '@/hooks/useBinding';

// khung quét nạp khi bấm nút (thư viện đọc mã chỉ tải lúc cần)
const CyberBarcodeScanner = lazy(() => import('./CyberBarcodeScanner'));

/**
 * Ô NHẬP CÓ NÚT QUÉT QR / MÃ VẠCH – bấm nút -> popup quét (camera hoặc ảnh) -> đọc được 1 mã thì tự điền vào ô và đóng.
 * Vẫn gõ tay / máy quét mã vạch cầm tay (giả lập bàn phím) như ô nhập bình thường.
 *
 *   <CyberBarcodeInput {...f.bind('Ma_Vt')} label="Mã hàng" onScan={(text, r) => timHang(text)} />
 *
 * Props: như CyberTextBox (label, placeholder, readOnly, disabled, upperCase, onEnter...) +
 *   onScan(text, result)  sau khi quét điền vào ô (result: { text, format, formatName, source, image })
 *   formats               giới hạn định dạng (vd ['qr_code'] hoặc ['ean_13', 'code_128'])
 *   scanTitle             tiêu đề popup (mặc định "Quét mã")
 */
export default function CyberBarcodeInput(props) {
  const { onScan, formats, scanTitle = 'Quét mã', readOnly, disabled } = props;
  const [, setValue] = useBinding(props);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false); // đã mở 1 lần -> giữ popup để có hiệu ứng đóng

  const onDetect = (r) => {
    const text = props.upperCase ? r.text.toUpperCase() : r.text; // giống khi gõ tay vào ô upperCase
    setValue(text, r);
    onScan?.(text, r);
    setOpen(false);
  };

  const { onScan: _o, formats: _f, scanTitle: _t, ...boxProps } = props;
  return (
    <>
      <CyberTextBox
        {...boxProps}
        addon={!readOnly && !disabled && (
          <button type="button" className="cy-btn-icon bc-input__btn" title="Quét QR / mã vạch" aria-label="Quét QR / mã vạch"
            onClick={() => { setSeen(true); setOpen(true); }}>
            <Icon name="qr" size={16} />
          </button>
        )}
      />
      {seen && (
        <CyberPopup open={open} onClose={() => setOpen(false)} title={scanTitle} width={560}>
          <Suspense fallback={<div className="bc__loading"><span className="cy-lookup__spin" /> Đang tải bộ đọc mã...</div>}>
            {open && <CyberBarcodeScanner continuous={false} formats={formats} height={320} onDetect={onDetect} />}
          </Suspense>
        </CyberPopup>
      )}
    </>
  );
}
