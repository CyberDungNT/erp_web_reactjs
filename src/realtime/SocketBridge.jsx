import { useEffect } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { toast } from '@/components/cyber';
import { socket } from './socket';
import { useSocketEvent } from './useSocket';

/**
 * Gắn 1 lần trong App: đăng nhập -> mở kết nối realtime (gửi TokenKey), đăng xuất -> đóng.
 * Kèm sự kiện dùng chung toàn app:
 *   'Notify' { title, message, type: 'success'|'info'|'warning'|'error' } -> bật toast
 */
export default function SocketBridge() {
  const { user } = useAuth();
  const token = user?.TokenKey || '';
  const userName = user?.User_name || '';
  const name = user?.Comment || userName;
  const unit = user?.Ma_TTCP || '';

  useEffect(() => {
    if (!userName) { socket.disconnect(); return; }
    socket.connect({ token, user: userName, name, unit });
  }, [token, userName, name, unit]);

  useSocketEvent('Notify', (n = {}) => {
    const show = toast[n.type] || toast.info;
    show(n.message || '', { title: n.title || (n.from ? `Từ ${n.from}` : 'Thông báo'), duration: 6000 });
  });

  return null;
}
