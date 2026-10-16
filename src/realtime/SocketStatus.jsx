import { useSocketStatus } from './useSocket';

const TEXT = {
  V: { idle: 'Chưa kết nối', connecting: 'Đang kết nối...', connected: 'Trực tuyến', reconnecting: 'Đang kết nối lại...', disconnected: 'Mất kết nối' },
  E: { idle: 'Not connected', connecting: 'Connecting...', connected: 'Online', reconnecting: 'Reconnecting...', disconnected: 'Offline' },
};

/** Nhãn trạng thái kết nối realtime (chấm màu + chữ). compact = chỉ hiện chấm. */
export default function SocketStatus({ lang = 'V', compact = false, className = '' }) {
  const status = useSocketStatus();
  const text = (TEXT[lang] || TEXT.V)[status];
  return (
    <span className={`rt-status rt-status--${status} ${compact ? 'rt-status--compact' : ''} ${className}`} title={text} role="status">
      <i aria-hidden="true" />
      {!compact && <span>{text}</span>}
    </span>
  );
}
