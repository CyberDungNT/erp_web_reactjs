import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CyberTextBox, CyberCheckBox } from '../components/cyber';
import Icon from '../components/icons/Icon';
import { useCyberForm } from '../hooks/useCyberForm';
import { useAuth } from '../auth/AuthContext';
import { getLastLogin } from '../auth/authService';
import { apiConfig } from '../api/apiClient';
import './login.css';

export default function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const last = getLastLogin();

  const form = useCyberForm({
    UserName: last.userName || '',
    Password: '',
    MaTTCP: last.maTTCP || '01',
    Remember: !!last.remember,
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  // Ô nào đã nhập thì bỏ thông báo lỗi của ô đó
  const shownErrors = Object.fromEntries(
    Object.entries(errors).filter(([k]) => !String(form.data[k] ?? '').trim())
  );

  if (session) return <Navigate to={location.state?.from || '/'} replace />;

  const validate = () => {
    const e = {};
    if (!form.data.UserName.trim()) e.UserName = 'Vui lòng nhập tên đăng nhập';
    // if (!form.data.Password) e.Password = 'Vui lòng nhập mật khẩu';
    if (!String(form.data.MaTTCP || '').trim()) e.MaTTCP = 'Vui lòng nhập mã đơn vị';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e?.preventDefault();
    setMessage(null);
    if (!validate() || loading) return;
    setLoading(true);
    try {
      const res = await login({
        userName: form.data.UserName.trim(),
        password: form.data.Password,
        maTTCP: String(form.data.MaTTCP).trim(),
        remember: form.data.Remember,
      });
      if (res.ok) {
        navigate(location.state?.from || '/', { replace: true });
      } else {
        setMessage(res.message);
        form.setField('Password', '');
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkCaps = (e) => setCapsLock(!!e.getModifierState?.('CapsLock'));

  return (
    <div className="login">
      <aside className="login__brand">
        <div className="login__brand-inner">
          <div className="login__logo">
            <span className="login__logo-mark">C</span>
            <span>Cyber<b>Plus</b></span>
          </div>
          <h1>Quản trị doanh nghiệp<br />trên một nền tảng.</h1>
          <p>Kế toán, bán hàng, kho, dịch vụ và phê duyệt — làm việc ở bất kỳ đâu, ngay trên trình duyệt.</p>
          <ul className="login__features">
            <li><Icon name="bank" /> Kế toán & tài chính</li>
            <li><Icon name="car" /> Bán xe & dịch vụ</li>
            <li><Icon name="box" /> Quản lý kho</li>
            <li><Icon name="check" /> Phê duyệt trực tuyến</li>
          </ul>
        </div>
        <div className="login__grid" aria-hidden="true" />
      </aside>

      <main className="login__main">
        <form className="login__card" onSubmit={submit} noValidate>
          <h2>Đăng nhập</h2>
          <p className="login__sub">Nhập tài khoản được cấp để tiếp tục</p>

          {message && (
            <div className="login__error" role="alert">
              <Icon name="warning" size={16} /> {message}
            </div>
          )}

          <CyberTextBox
            {...form.bind('UserName')}
            layout="vertical"
            label="Tên đăng nhập"
            name="username"
            autoComplete="username"
            autoFocus={!form.data.UserName}
            placeholder="Nhập tên đăng nhập"
            error={shownErrors.UserName}
          />
          <CyberTextBox
            {...form.bind('Password')}
            layout="vertical"
            label="Mật khẩu"
            name="password"
            type={showPass ? 'text' : 'password'}
            autoComplete="current-password"
            autoFocus={!!form.data.UserName}
            placeholder="Nhập mật khẩu"
            error={shownErrors.Password}
            onKeyUp={checkCaps}
            addon={
              <button type="button" className="cy-btn-icon login__eye" tabIndex={-1}
                title={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={() => setShowPass((v) => !v)}>
                <Icon name={showPass ? 'eyeOff' : 'eye'} size={16} />
              </button>
            }
          />
          {capsLock && <div className="login__caps">Caps Lock đang bật</div>}
          <CyberTextBox
            {...form.bind('MaTTCP')}
            layout="vertical"
            label="Mã đơn vị"
            name="unit"
            placeholder="VD: 01"
            maxLength={20}
            error={shownErrors.MaTTCP}
          />
          <CyberCheckBox {...form.bind('Remember')} text="Ghi nhớ đăng nhập trên máy này" />

          <button type="submit" className="cy-btn cy-btn--primary login__submit" disabled={loading}>
            {loading ? <span className="login__spinner" /> : <Icon name="lock" size={16} />}
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          {apiConfig.USE_MOCK && (
            <p className="login__hint">Chế độ dữ liệu giả: mật khẩu <b>123</b> để đăng nhập thành công.</p>
          )}
        </form>
        <footer className="login__footer">Cyber Plus · {new Date().getFullYear()}</footer>
      </main>
    </div>
  );
}
