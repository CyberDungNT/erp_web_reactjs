// REALTIME (socket) dùng chung: import { socket, useSocketEvent, SocketStatus } from '@/realtime';
import './realtime.css';

export { socket, socketConfig } from './socket';
export { useSocketStatus, useSocketEvent, useSocketGroup, useSocketReady } from './useSocket';
export { default as SocketBridge } from './SocketBridge';
export { default as SocketStatus } from './SocketStatus';
export { usePushStatus, initPush, enablePush, disablePush, syncPush, reportVisibility, onOpenChat } from './push';
