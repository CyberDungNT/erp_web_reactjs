import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from '@/auth/AuthContext';
import MainLayout from '@/layouts/MainLayout';
import LoginPage from '@/pages/login/LoginPage';
import { CyberMsgBoxHost, CyberToastHost } from '@/components/cyber';
import { SocketBridge } from '@/realtime';
import NetworkStatus from '@/components/NetworkStatus';

/**
 * /login  -> màn đăng nhập
 * /       -> màn chính (cần đăng nhập). Các chức năng mở dạng tab bên trong,
 *            khai báo Menu_Id -> component tại src/screens/registry.js
 */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CyberMsgBoxHost />
      <CyberToastHost />
      {/* Realtime: tự kết nối khi đăng nhập, ngắt khi đăng xuất */}
      <SocketBridge />
      {/* Mất mạng / có mạng lại -> thông báo (dữ liệu đang nhập được giữ: bản nháp trong useCyberForm) */}
      <NetworkStatus />
    </AuthProvider>
  );
}
