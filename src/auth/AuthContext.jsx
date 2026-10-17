import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import * as auth from './authService';

/**
 * Thông tin đăng nhập dùng chung toàn app.
 *   const { session, user, lang, login, logout, setLang, restoring, notice } = useAuth();
 *   user      -> dòng thông tin (User_name, Ma_Dvcs, Ten_TTCP, TokenKey, ...)
 *   session   -> { info, tables, dashboards, lang, loginAt }  (menu: getMenuRows(session))
 *   lang      -> 'V' (tiếng Việt, dùng cột Bar) | 'E' (tiếng Anh, dùng cột Bar2)
 *   restoring -> true khi đang tự đăng nhập lại bằng TokenKey đã lưu (lúc mở web)
 *   notice    -> thông báo cho màn login khi tự đăng nhập lại thất bại (token hết hạn...)
 *
 * Ghi nhớ đăng nhập: chỉ lưu TokenKey đã MÃ HOÁ (authService.saveToken).
 * Mở web lại -> giải mã -> gọi CP_SysLogin với @M_TokenKey để lấy phiên mới.
 */
const AuthContext = createContext(null);

const makeSession = (res, lang) => ({
  info: res.info,
  tables: res.tables,
  dashboards: res.dashboards,
  lang: lang || (res.info.M_Lan === 'E' ? 'E' : 'V'),
  loginAt: new Date().toISOString(),
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(() => auth.hasSavedToken());
  const [notice, setNotice] = useState(null);
  const started = useRef(false);

  // Mở web: có token đã lưu -> tự đăng nhập lại bằng token
  useEffect(() => {
    if (started.current) return; // StrictMode chạy effect 2 lần -> chỉ gọi thủ tục 1 lần
    started.current = true;
    auth.clearLegacySession();
    if (!auth.hasSavedToken()) return;
    (async () => {
      try {
        const res = await auth.loginWithSavedToken();
        if (res?.ok) {
          const s = makeSession(res, res.lang);
          setSession(s);
          auth.saveToken({ tokenKey: res.tokenKey, userName: res.userName, maTTCP: res.maTTCP, lang: s.lang }).catch(() => {});
        } else {
          auth.clearToken();
          if (res) setNotice(res.message || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
        }
      } catch (err) {
        // Lỗi mạng / server: giữ token để lần sau thử lại, chỉ báo lỗi
        setNotice(`Không tự đăng nhập lại được: ${err.message}`);
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  /**
   * Đăng nhập bằng mật khẩu. Khi thành công KHÔNG vào app ngay mà trả về res.commit():
   * màn login chạy hiệu ứng xong mới gọi commit() để lưu token (mã hoá) và chuyển vào màn chính.
   */
  const login = useCallback(async ({ userName, password, maTTCP, remember: rem = true, lang }) => {
    const res = await auth.login({ userName, password, maTTCP, silent: true }); // lỗi do màn login báo bằng toast
    if (res.ok) {
      const s = makeSession(res, lang);
      auth.setLastLogin({ userName, maTTCP, remember: rem, lang });
      res.commit = () => {
        setNotice(null);
        if (rem) {
          auth.saveToken({ tokenKey: res.info.TokenKey, userName, maTTCP, lang: s.lang })
            .catch((err) => console.warn('Không lưu được token đăng nhập:', err));
        }
        setSession(s);
      };
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    auth.clearToken();
    setSession(null);
  }, []);

  const setLang = useCallback((lang) => {
    setSession((s) => (s ? { ...s, lang } : s));
    auth.updateSavedToken({ lang }).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.info || null, lang: session?.lang || 'V', login, logout, setLang, restoring, notice }),
    [session, login, logout, setLang, restoring, notice]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}

/** Màn chờ khi đang tự đăng nhập lại bằng token */
export function AuthSplash() {
  return (
    <div className="auth-splash" role="status" aria-live="polite">
      <span className="auth-splash__spin" aria-hidden="true" />
      <span>Đang khôi phục phiên đăng nhập...</span>
    </div>
  );
}

/** Bọc các trang cần đăng nhập: chưa đăng nhập -> chuyển về /login */
export function RequireAuth({ children }) {
  const { session, restoring } = useAuth();
  const location = useLocation();
  if (restoring) return <AuthSplash />;
  // Phiên hết hạn / F5 không ghi nhớ đăng nhập -> đăng nhập lại quay về đúng chức năng đang mở (?w=..&f=..)
  // Chủ động bấm Đăng xuất -> về trang chủ
  if (!session) return <Navigate to="/login" replace state={{ from: auth.isLogoutFx() ? '/' : location.pathname + location.search }} />;
  return children;
}
