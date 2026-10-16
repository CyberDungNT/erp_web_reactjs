import { useEffect, useRef } from 'react';
import { toast } from '@/components/cyber';

/**
 * Báo mất mạng / có mạng lại (gắn 1 lần trong App).
 * Mất mạng: toast cảnh báo giữ nguyên tới khi có mạng – dữ liệu đang nhập vẫn còn trên form và được lưu nháp
 * (xem hooks/useCyberForm.js), có mạng lại thì lưu tiếp bình thường. Realtime tự kết nối lại (src/realtime).
 */
export default function NetworkStatus() {
  const offToast = useRef(null);

  useEffect(() => {
    const onOffline = () => {
      if (offToast.current) return;
      offToast.current = toast.warning(
        'Dữ liệu bạn đang nhập vẫn được giữ lại. Khi có mạng, bấm Lưu lại như bình thường.',
        { title: 'Mất kết nối mạng', duration: 0 },
      );
    };
    const onOnline = () => {
      if (offToast.current) toast.dismiss(offToast.current);
      offToast.current = null;
      toast.success('Đã có mạng trở lại.', { duration: 3000 });
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    if (navigator.onLine === false) onOffline();
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return null;
}
