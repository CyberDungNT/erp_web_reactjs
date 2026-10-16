import { useEffect, useRef, useSyncExternalStore } from 'react';
import { socket } from './socket';

/**
 * HOOK REALTIME cho component – tự huỷ khi đóng màn.
 *
 *   const status = useSocketStatus();                       // 'connected' | 'reconnecting' | ...
 *   useSocketEvent('ChungTuDaDuyet', (ct) => f.reload());   // nghe sự kiện server đẩy xuống
 *   useSocketGroup(`donvi:${user.Ma_TTCP}`);                // vào nhóm khi mở màn, rời khi đóng
 *   useSocketReady(() => socket.invoke('JoinRoom', room));  // chạy mỗi lần kết nối xong (cả sau khi mất mạng)
 */

/** Trạng thái kết nối hiện tại, tự render lại khi đổi */
export function useSocketStatus() {
  return useSyncExternalStore(socket.onStatus, () => socket.status);
}

/** Nghe 1 sự kiện. handler luôn là bản mới nhất (không cần useCallback). */
export function useSocketEvent(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!event) return undefined;
    return socket.on(event, (...args) => ref.current?.(...args));
  }, [event]);
}

/** Vào 1 nhóm khi mở màn, rời nhóm khi đóng màn / đổi nhóm */
export function useSocketGroup(group) {
  const status = useSocketStatus();
  useEffect(() => {
    if (!group || status !== 'connected') return undefined;
    socket.join(group).catch(() => {});
    return () => { socket.leave(group); };
  }, [group, status]);
}

/** Chạy fn mỗi khi kết nối sẵn sàng (lần đầu + sau mỗi lần kết nối lại) – dùng để tải lại dữ liệu bị lỡ */
export function useSocketReady(fn, deps = []) {
  const status = useSocketStatus();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (status === 'connected') ref.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ...deps]);
}
