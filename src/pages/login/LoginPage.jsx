import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CyberTextBox, CyberSelect, toast } from '@/components/cyber';
import Icon from '@/components/icons/Icon';
import { useCyberForm } from '@/hooks/useCyberForm';
import { AuthSplash, useAuth } from '@/auth/AuthContext';
import { getLastLogin, getUnits, LOGOUT_FX_KEY } from '@/auth/authService';
import { apiConfig } from '@/api/apiClient';
import { BRAND, SOCIAL_LOGINS } from '@/config/brand';
import './login.css';

// Thời gian các bước hiệu ứng đăng nhập thành công (ms)
const T_CHECK = 450;     // nút chuyển sang dấu tích -> vòng tròn xanh lan ra
const T_LEAVE = 1750;    // màn chào mừng mờ dần về nền sáng
const T_ENTER = 2100;    // vào màn chính

const TEXT = {
  V: {
    welcome: 'Chào mừng trở lại', sub: 'Đăng nhập để tiếp tục phiên làm việc', badge: 'Hệ thống quản trị doanh nghiệp', remember: 'Ghi nhớ đăng nhập',
    user: 'Tài khoản', userPh: 'Nhập tài khoản', pass: 'Mật khẩu', passPh: 'Nhập mật khẩu',
    unit: 'Đơn vị', unitPh: 'Nhập tài khoản để tải đơn vị', unitPick: 'Chọn đơn vị', unitLoading: 'Đang tải đơn vị...',
    forgot: 'Quên mật khẩu?', login: 'Đăng nhập', loading: 'Đang xác thực...', ok: 'Thành công',
    or: 'hoặc tiếp tục với', caps: 'Caps Lock đang bật', success: 'Đăng nhập thành công', hello: 'Chào mừng',
    needUser: 'Vui lòng nhập tài khoản', needPass: 'Vui lòng nhập mật khẩu', needUnit: 'Vui lòng chọn đơn vị',
    noUnit: 'Tài khoản không có đơn vị nào được phân quyền', group: 'Đơn vị cơ sở',
    forgotMsg: 'Vui lòng liên hệ quản trị hệ thống để cấp lại mật khẩu.', social: (n) => `Đăng nhập bằng ${n} chưa được kích hoạt.`,
  },
  E: {
    welcome: 'Welcome back', sub: 'Sign in to continue your session', badge: 'Enterprise management system', remember: 'Keep me signed in',
    user: 'Username', userPh: 'Enter username', pass: 'Password', passPh: 'Enter password',
    unit: 'Unit', unitPh: 'Enter username to load units', unitPick: 'Select unit', unitLoading: 'Loading units...',
    forgot: 'Forgot password?', login: 'Sign in', loading: 'Signing in...', ok: 'Success',
    or: 'or continue with', caps: 'Caps Lock is on', success: 'Signed in successfully', hello: 'Welcome',
    needUser: 'Please enter your username', needPass: 'Please enter your password', needUnit: 'Please select a unit',
    noUnit: 'This account has no unit assigned', group: 'Company',
    forgotMsg: 'Please contact your administrator to reset your password.', social: (n) => `Sign in with ${n} is not enabled yet.`,
  },
};

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * Chấm chạy quanh các vòng tròn góc dưới panel trái (cùng kiểu chấm cam):
 * [bán kính vòng (170 | 240 | 310), góc ban đầu (độ), kích thước, màu, số giây chạy hết 1 vòng]
 */
const ORBIT_DOTS = [
  [170, 200, 6, '#5B8CFF', 34],
  [240, 245, 7, '#FFB547', 52],
  [240, 160, 4, '#FFFFFF', 52],
  [310, 215, 5, '#3DD6A3', 70],
  [310, 270, 8, '#FF7A59', 70],
  [170, 300, 4, '#FFFFFF', 34],
];

export default function LoginPage() {
  const { session, login, restoring, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [last] = useState(() => getLastLogin());

  const form = useCyberForm({ UserName: last.userName || '', Password: '', MaTTCP: last.maTTCP || '' });
  const [lang, setLang] = useState(last.lang === 'E' ? 'E' : 'V');
  const langPicked = useRef(!!last.lang);
  const t = TEXT[lang];

  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState(null);
  const unitsFor = useRef(null);   // tài khoản đã tải đơn vị
  const unitsPromise = useRef(null); // lần tải đơn vị đang chạy (để nút Đăng nhập chờ)
  const dataRef = useRef(form.data);
  dataRef.current = form.data;

  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null); // { type: 'error' | 'info', text }
  // Tự đăng nhập lại bằng token thất bại (hết hạn...) -> báo trên thẻ đăng nhập
  useEffect(() => { if (notice) setMessage({ type: 'info', text: notice }); }, [notice]);
  // Vừa đăng xuất -> lớp màu đang phủ kín màn hình thu lại, mở ra màn login
  const [bye, setBye] = useState(() => { try { return sessionStorage.getItem(LOGOUT_FX_KEY) === '1'; } catch { return false; } });
  useEffect(() => {
    try { sessionStorage.removeItem(LOGOUT_FX_KEY); } catch { /* bỏ qua */ }
    if (!bye) return undefined;
    const id = setTimeout(() => setBye(false), 1100);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [phase, setPhase] = useState('idle'); // idle | loading | success | reveal | leave
  const [shake, setShake] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(() => last.remember !== false); // ghi nhớ đăng nhập (lưu TokenKey đã mã hoá)
  const [capsLock, setCapsLock] = useState(false);
  const [welcome, setWelcome] = useState('');
  const [origin, setOrigin] = useState({ x: '50%', y: '50%' });
  const btnRef = useRef(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);


  /**
   * Rời ô tài khoản -> gọi CP_SysGetUnits lấy danh sách đơn vị.
   * Giữ đơn vị đang chọn nếu vẫn có trong danh sách, không thì chọn đơn vị mặc định (bảng 1).
   */
  const loadUnits = useCallback(async (userName) => {
    const u = String(userName || '').trim();
    if (!u) {
      unitsFor.current = null;
      setUnits([]);
      setUnitsError(null);
      return [];
    }
    if (norm(u) === unitsFor.current) return unitsPromise.current; // đã / đang tải cho tài khoản này
    unitsFor.current = norm(u);
    setUnitsLoading(true);
    setUnitsError(null);
    const run = (async () => { try {
      const r = await getUnits(u);
      if (unitsFor.current !== norm(u)) return null; // người dùng đã đổi tài khoản khác
      setUnits(r.units);
      const cur = dataRef.current.MaTTCP;
      const keep = r.units.some((x) => String(x.Ma_TTCP) === String(cur));
      const def = r.defaultUnit?.Ma_TTCP && r.units.some((x) => String(x.Ma_TTCP) === String(r.defaultUnit.Ma_TTCP))
        ? r.defaultUnit.Ma_TTCP : r.units[0]?.Ma_TTCP;
      const chosen = keep ? cur : def ?? '';
      dataRef.current = { ...dataRef.current, MaTTCP: chosen }; // để nút Đăng nhập đang chờ đọc được ngay
      form.setField('MaTTCP', chosen);
      if (r.lang && !langPicked.current) setLang(r.lang);
      if (!r.units.length) setUnitsError('noUnit');
      return r.units;
    } catch (err) {
      unitsFor.current = null;
      setUnits([]);
      setUnitsError(err.message);
      return [];
    } finally {
      setUnitsLoading(false);
    } })();
    unitsPromise.current = run;
    return run;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tài khoản nhớ từ lần trước -> tải đơn vị ngay
  useEffect(() => {
    if (last.userName) loadUnits(last.userName);
  }, [last.userName, loadUnits]);

  const shownErrors = Object.fromEntries(
    Object.entries(errors).filter(([k]) => !String(form.data[k] ?? '').trim())
  );

  if (restoring) return <AuthSplash />;
  if (session) return <Navigate to={location.state?.from || '/'} replace />;

  const fail = (text) => {
    setMessage({ type: 'error', text });
    setShake((n) => n + 1);
    setPhase('idle');
  };

  const validate = (d) => {
    const e = {};
    if (!d.UserName.trim()) e.UserName = t.needUser;
    // if (!d.Password) e.Password = t.needPass;
    if (!String(d.MaTTCP || '').trim()) e.MaTTCP = t.needUnit;
    setErrors(e);
    if (Object.keys(e).length) setShake((n) => n + 1);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (phase !== 'idle') return;
    setMessage(null);
    setPhase('loading');
    // Đơn vị chưa tải xong (gõ nhanh rồi Enter) -> chờ tải xong, đơn vị mặc định được chọn sẵn
    if (norm(form.data.UserName)) await loadUnits(form.data.UserName);
    const d = dataRef.current;
    if (!validate(d)) { setPhase('idle'); return; }
    try {
      const res = await login({
        userName: d.UserName.trim(),
        password: d.Password,
        maTTCP: String(d.MaTTCP).trim(),   // mã đơn vị đã chọn -> @M_Ma_TTCP
        remember,
        lang,
      });
      if (!res.ok) {
        form.setField('Password', '');
        return fail(res.message);
      }
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setOrigin({ x: `${r.left + r.width / 2}px`, y: `${r.top + r.height / 2}px` });
      setWelcome(res.info?.Comment || res.info?.User_name || '');
      setPhase('success');
      timers.current.push(setTimeout(() => setPhase('reveal'), T_CHECK));
      timers.current.push(setTimeout(() => setPhase('leave'), T_LEAVE));
      timers.current.push(setTimeout(() => {
        res.commit();
        navigate(location.state?.from || '/', { replace: true, state: { intro: true } });
      }, T_ENTER));
    } catch (err) {
      fail(err.message);
    }
  };

  const busy = phase !== 'idle';
  // Tên đơn vị hiển thị trên trang: đơn vị đang chọn, nếu chưa có thì lấy tên mặc định trong brand.js
  // const unitName =  units.find((x) => String(x.Ma_TTCP) === String(form.data.MaTTCP))?.Ten_TTCP || BRAND.unitName;
  const unitName = "Tên đơn vị";
  const unitError = unitsError === 'noUnit' ? t.noUnit : unitsError;
  const pickLang = (l) => { setLang(l); langPicked.current = true; };

  return (
    <div className={`lg lg--${phase} ${bye ? 'lg--bye' : ''}`}>
      {/* ---------- Bên trái: panel thương hiệu ---------- */}
      <section className="lg__left">
        <svg className="lg__rings" aria-hidden="true" width="640" height="640" viewBox="0 0 640 640">
          <circle cx="320" cy="320" r="310" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1.5" />
          <circle className="lg__ring-dash" cx="320" cy="320" r="240" fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="1.5" strokeDasharray="4 8" />
          <circle cx="320" cy="320" r="170" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.5" />
          <circle className="lg__ring-core" cx="320" cy="320" r="100" fill="#2448D8" opacity=".6" />
          {/* Các chấm nhỏ chạy quanh các vòng tròn (giống chấm cam) */}
          {ORBIT_DOTS.map(([ring, deg, size, color, sec], i) => (
            <g key={i} className="lg__orbit" style={{ '--t': `${sec}s` }}>
              <circle cx={320 + ring * Math.cos((deg * Math.PI) / 180)} cy={320 + ring * Math.sin((deg * Math.PI) / 180)} r={size} fill={color} />
            </g>
          ))}
          <circle className="lg__ring-dot" cx="545" cy="150" r="12" fill="#FFB547" />
          <circle cx="120" cy="230" r="6" fill="#FFFFFF" opacity=".6" />
        </svg>

        <div className="lg__brand">
          <span className="lg__mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#12161F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18 L12 4 L20 18" /><path d="M8 13 H16" />
            </svg>
          </span>
          <span className="lg__brand-name" title={unitName}>{unitName}</span>
        </div>

        <div className="lg__hero">
          <span className="lg__badge">{t.badge}</span>
          <h1 className="lg__headline">{BRAND.slogan[0]},<br />{BRAND.slogan[1]}.</h1>
          <p className="lg__desc">{BRAND.sloganSub}</p>
        </div>

        <p className="lg__copy">© {new Date().getFullYear()} {unitName}</p>
      </section>

      {/* ---------- Bên phải: thẻ đăng nhập ---------- */}
      <main className="lg__right">
        <form key={shake} className={`lg__card ${shake ? 'is-shake' : ''}`} onSubmit={submit} noValidate>
          <div className="lg__card-top">
            <div className="lg__heading">
              <h2 className="lg__title">{t.welcome}</h2>
              <p className="lg__sub">{t.sub}</p>
            </div>
            {/* Đổi ngôn ngữ: bấm là đổi ngay */}
            <div className={`lg__lang lg__lang--${lang}`} role="radiogroup" aria-label="Ngôn ngữ / Language">
              <span className="lg__lang-thumb" aria-hidden="true" />
              {[['V', 'VN', 'Tiếng Việt'], ['E', 'EN', 'English']].map(([code, short, name]) => (
                <button key={code} type="button" role="radio" aria-checked={lang === code} title={name}
                  className={lang === code ? 'is-on' : ''} onClick={() => pickLang(code)}>
                  <Flag code={code} /> {short}
                </button>
              ))}
            </div>
          </div>

          {message && (
            <div className={`lg__msg lg__msg--${message.type}`} role="alert">
              <Icon name="warning" size={15} /> {message.text}
            </div>
          )}

          <fieldset className="lg__fields" disabled={busy}>
            <CyberTextBox
              {...form.bind('UserName')} className="lg__f lg__f--user"
              id="login-user" layout="vertical" label={t.user} name="username" autoComplete="username"
              autoFocus={!form.data.UserName} placeholder={t.userPh} error={shownErrors.UserName}
              onBlur={(e) => loadUnits(e.target.value)}
              onEnter={() => document.getElementById('login-pass')?.focus()}
            />
            <CyberTextBox
              {...form.bind('Password')} className="lg__f lg__f--pass"
              id="login-pass" layout="vertical" label={t.pass} name="password" type={showPass ? 'text' : 'password'}
              autoComplete="current-password" autoFocus={!!form.data.UserName} placeholder={t.passPh}
              error={shownErrors.Password} onKeyUp={(e) => setCapsLock(!!e.getModifierState?.('CapsLock'))}
              addon={
                <button type="button" className="lg__eye" tabIndex={-1}
                  title={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPass((v) => !v)}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} size={19} />
                </button>
              }
            />
            {capsLock && <div className="lg__caps"><Icon name="warning" size={13} /> {t.caps}</div>}
            <CyberSelect
              {...form.bind('MaTTCP')} className="lg__f lg__f--unit"
              layout="vertical" label={t.unit}
              dataSource={units} valueField="Ma_TTCP" displayField="Ten_TTCP"
              groupField="Ma_Dvcs" groupLabel={(g) => `${t.group} ${g}`} showValue
              loading={unitsLoading} loadingText={t.unitLoading}
              placeholder={units.length ? t.unitPick : t.unitPh}
              disabled={!units.length && !unitsLoading}
              error={unitError || shownErrors.MaTTCP}
            />
          </fieldset>

          <div className="lg__row">
            <label className="lg__remember">
              <input type="checkbox" checked={remember} disabled={busy} onChange={(e) => setRemember(e.target.checked)} />
              {t.remember}
            </label>
            <span className="lg__forgot">
              {BRAND.forgotPasswordUrl
                ? <a href={BRAND.forgotPasswordUrl} target="_blank" rel="noreferrer">{t.forgot}</a>
                : <button type="button" onClick={() => setMessage({ type: 'info', text: t.forgotMsg })}>{t.forgot}</button>}
            </span>
          </div>

          <button ref={btnRef} type="submit" className={`lg__submit is-${phase === 'leave' ? 'reveal' : phase}`} disabled={busy}
            aria-label={phase === 'idle' ? t.login : phase === 'loading' ? t.loading : t.ok} aria-live="polite">
            <span className="lg__submit-face lg__submit-face--idle" aria-hidden="true">
              {t.login}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="lg__arrow">
                <path d="M5 12 H19" /><path d="M13 6 L19 12 L13 18" />
              </svg>
            </span>
            <span className="lg__submit-face lg__submit-face--loading" aria-hidden="true"><span className="lg__spinner" /> {t.loading}</span>
            <span className="lg__submit-face lg__submit-face--success" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" className="lg__tick" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              {t.ok}
            </span>
          </button>

          {SOCIAL_LOGINS.some((s) => s.enabled) && (
            <>
              <div className="lg__or"><span>{t.or}</span></div>
              <div className="lg__social">
                {SOCIAL_LOGINS.filter((s) => s.enabled).map((s) => (
                  <button key={s.key} type="button" className="lg__social-btn" disabled={busy}
                    onClick={() => toast.info(t.social(s.text), { title: s.text })}>
                    <SocialIcon name={s.key} /> {s.text}
                  </button>
                ))}
              </div>
            </>
          )}

          {apiConfig.USE_MOCK && <p className="lg__hint">Dữ liệu giả: mật khẩu <b>123</b></p>}
          <footer className="lg__foot">© {new Date().getFullYear()} {unitName} · Version {BRAND.version}</footer>
        </form>
      </main>

      {bye && <div className="lg__bye" aria-hidden="true" />}

      {(phase === 'reveal' || phase === 'leave') && (
        <div className={`lg__reveal ${phase === 'leave' ? 'is-leave' : ''}`} style={{ '--ox': origin.x, '--oy': origin.y }} role="status">
          <div className="lg__reveal-inner">
            <svg viewBox="0 0 52 52" className="lg__reveal-check" aria-hidden="true">
              <circle cx="26" cy="26" r="24" />
              <path d="M15 27l7 7 15-16" />
            </svg>
            <div className="lg__reveal-title">{t.success}</div>
            {welcome && <div className="lg__reveal-sub">{t.hello}, {welcome}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Flag({ code }) {
  if (code === 'E') {
    return (
      <svg viewBox="0 0 20 20" width="18" height="18" className="lg__flag" aria-hidden="true">
        <circle cx="10" cy="10" r="10" fill="#1f4aa8" />
        <path d="M0 10h20M10 0v20" stroke="#fff" strokeWidth="5" />
        <path d="M0 10h20M10 0v20" stroke="#d6283a" strokeWidth="2.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" className="lg__flag" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="#da251d" />
      <path d="M10 4.6l1.27 3.9h4.1l-3.32 2.41 1.27 3.9L10 12.4l-3.32 2.41 1.27-3.9L4.63 8.5h4.1z" fill="#ffcd00" />
    </svg>
  );
}

function SocialIcon({ name }) {
  if (name === 'google') {
    return (
      <svg viewBox="0 0 48 48" width="17" height="17" aria-hidden="true">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
      </svg>
    );
  }
  if (name === 'microsoft') {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <rect x="0" y="0" width="9.5" height="9.5" fill="#f25022" />
        <rect x="10.5" y="0" width="9.5" height="9.5" fill="#7fba00" />
        <rect x="0" y="10.5" width="9.5" height="9.5" fill="#00a4ef" />
        <rect x="10.5" y="10.5" width="9.5" height="9.5" fill="#ffb900" />
      </svg>
    );
  }
  return <Icon name={name === 'qr' ? 'qr' : 'phone'} size={17} />;
}
