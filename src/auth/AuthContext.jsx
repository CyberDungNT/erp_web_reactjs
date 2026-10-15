import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import * as auth from './authService';

/**
 * Thông tin đăng nhập dùng chung toàn app.
 *   const { session, user, lang, login, logout, setLang } = useAuth();
 *   user      -> dòng thông tin (User_name, Ma_Dvcs, Ten_TTCP, TokenKey, ...)
 *   session   -> { info, tables, dashboards, lang, loginAt }  (menu: getMenuRows(session))
 *   lang      -> 'V' (tiếng Việt, dùng cột Bar) | 'E' (tiếng Anh, dùng cột Bar2)
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => auth.loadSession());

  /**
   * Đăng nhập. Khi thành công KHÔNG vào app ngay mà trả về res.commit():
   * màn login chạy hiệu ứng xong mới gọi commit() để lưu phiên và chuyển vào màn chính.
   */
  const login = useCallback(async ({ userName, password, maTTCP, remember: rem, lang }) => {
    const res = await auth.login({ userName, password, maTTCP });
    if (res.ok) {
      const s = {
        info: res.info,
        tables: res.tables,
        dashboards: res.dashboards,
        lang: lang || (res.info.M_Lan === 'E' ? 'E' : 'V'),
        loginAt: new Date().toISOString(),
      };
      auth.setLastLogin({ userName, maTTCP, remember: rem, lang });
      res.commit = () => {
        auth.saveSession(s, rem);
        setSession(s);
      };
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    auth.clearSession();
    setSession(null);
  }, []);

  const setLang = useCallback((lang) => {
    setSession((s) => {
      if (!s) return s;
      const next = { ...s, lang };
      // giữ nguyên nơi lưu cũ (localStorage nếu đã chọn "ghi nhớ")
      auth.saveSession(next, auth.isRemembered());
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.info || null, lang: session?.lang || 'V', login, logout, setLang }),
    [session, login, logout, setLang]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}

/** Bọc các trang cần đăng nhập: chưa đăng nhập -> chuyển về /login */
export function RequireAuth({ children }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
