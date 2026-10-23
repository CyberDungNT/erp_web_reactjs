import { lazy } from 'react';
import { aiStore } from './aiStore';

/**
 * HỎI AI – trợ lý AI trong màn chính.
 *   Web:     AiPanel.jsx (khung ghim bên phải), aiApi.js (gọi API, đọc luồng), AiMarkdown.jsx (hiện câu trả lời)
 *   Máy chủ: API_App_Demo/Ai (POST /api/Ai/chat – gọi Claude, API key nằm trên máy chủ)
 *   Mở:      menu avatar -> "Hỏi AI", hoặc Ctrl + /
 */
export const widgets = [lazy(() => import('./AiPanel'))];

export const userMenu = [
  { key: 'ai', icon: 'sparkle', text: { V: 'Hỏi AI', E: 'Ask AI' }, onClick: () => aiStore.open() },
];
