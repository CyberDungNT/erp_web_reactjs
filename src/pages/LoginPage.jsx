import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CyberTextBox, CyberSelect } from '../components/cyber';
import Icon from '../components/icons/Icon';
import BrandLogo from '../components/BrandLogo';
import LoginIllustration from './LoginIllustration';
import { useCyberForm } from '../hooks/useCyberForm';
import { useAuth } from '../auth/AuthContext';
import { getLastLogin, getUnits } from '../auth/authService';
import { apiConfig } from '../api/apiClient';
import { BRAND, SOCIAL_LOGINS } from '../config/brand';
import './login.css';

// Thời gian các bước hiệu ứng đăng nhập thành công (ms)
const T_CHECK = 450;     // nút chuyển sang dấu tích -> vòng tròn xanh lan ra
const T_LEAVE = 1750;    // màn chào mừng mờ dần về nền sáng
const T_ENTER = 2100;    // vào màn chính

const TEXT = {
  V: {
    welcome: 'Chào mừng bạn đã quay trở lại!', sub: 'Đăng nhập để tiếp tục phiên làm việc',
    user: 'Tài khoản', userPh: 'Nhập tài khoản', pass: 'Mật khẩu', passPh: 'Nhập mật khẩu',
    unit: 'Đơn vị', unitPh: 'Nhập tài khoản để tải đơn vị', unitPick: 'Chọn đơn vị', unitLoading: 'Đang tải đơn vị...',
    forgot: 'Quên mật khẩu?', login: 'Đăng nhập', loading: 'Đang xác thực...', ok: 'Thành công',
    or: 'Hoặc đăng nhập bằng', caps: 'Caps Lock đang bật', success: 'Đăng nhập thành công', hello: 'Chào mừng',
    needUser: 'Vui lòng nhập tài khoản', needPass: 'Vui lòng nhập mật khẩu', needUnit: 'Vui lòng chọn đơn vị',
    noUnit: 'Tài khoản không có đơn vị nào được phân quyền', group: 'Đơn vị cơ sở',
    forgotMsg: 'Vui lòng liên hệ quản trị hệ thống để cấp lại mật khẩu.', social: (n) => `Đăng nhập bằng ${n} chưa được kích hoạt.`,
  },
  E: {
    welcome: 'Welcome back!', sub: 'Sign in to continue your session',
    user: 'Username', userPh: 'Enter username', pass: 'Password', passPh: 'Enter password',
    unit: 'Unit', unitPh: 'Enter username to load units', unitPick: 'Select unit', unitLoading: 'Loading units...',
    forgot: 'Forgot password?', login: 'Sign in', loading: 'Signing in...', ok: 'Success',
    or: 'Or sign in with', caps: 'Caps Lock is on', success: 'Signed in successfully', hello: 'Welcome',
    needUser: 'Please enter your username', needPass: 'Please enter your password', needUnit: 'Please select a unit',
    noUnit: 'This account has no unit assigned', group: 'Company',
    forgotMsg: 'Please contact your administrator to reset your password.', social: (n) => `Sign in with ${n} is not enabled yet.`,
  },
};

const norm = (s) => String(s || '').trim().toLowerCase();

export default function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [last] = useState(() => getLastLogin());

  const form = useCyberForm({ UserName: last.userName || '', Password: '', MaTTCP: last.maTTCP || '' });
  const [lang, setLang] = useState(last.lang === 'E' ? 'E' : 'V');
  const [langOpen, setLangOpen] = useState(false);
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
  const [phase, setPhase] = useState('idle'); // idle | loading | success | reveal | leave
  const [shake, setShake] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [welcome, setWelcome] = useState('');
  const [origin, setOrigin] = useState({ x: '50%', y: '50%' });
  const btnRef = useRef(null);
  const timers = useRef([]);
  const langRef = useRef(null);

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

  useEffect(() => {
    if (!langOpen) return;
    const close = (e) => { if (!langRef.current?.contains(e.target)) setLangOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [langOpen]);

  const shownErrors = Object.fromEntries(
    Object.entries(errors).filter(([k]) => !String(form.data[k] ?? '').trim())
  );

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
        remember: true,
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
        navigate(location.state?.from || '/', { replace: true });
      }, T_ENTER));
    } catch (err) {
      fail(err.message);
    }
  };

  const busy = phase !== 'idle';
  const unitError = unitsError === 'noUnit' ? t.noUnit : unitsError;
  const pickLang = (l) => { setLang(l); langPicked.current = true; setLangOpen(false); };

  return (
    <div className={`lg lg--${phase}`}>
      <div className="lg__watermark" aria-hidden="true">{BRAND.company}</div>

      {/* ---------- Bên trái ---------- */}
      <section className="lg__left">
        <BrandLogo />
        <h1 className="lg__slogan">
          <span>{BRAND.slogan[0]}</span>
          <span className="lg__slogan-hl">{BRAND.slogan[1]}</span>
        </h1>
        <p className="lg__desc">{BRAND.sloganSub}</p>
        <div className="lg__illu"><LoginIllustration /></div>
        <div className="lg__company">{BRAND.company}</div>
      </section>

      {/* ---------- Thẻ đăng nhập ---------- */}
      <main className="lg__right">
        <form key={shake} className={`lg__card ${shake ? 'is-shake' : ''}`} onSubmit={submit} noValidate>
          <div className="lg__card-top">
            <span className="lg__product"><i />{BRAND.product}</span>
            <div className="lg__lang" ref={langRef}>
              <button type="button" className="lg__lang-btn" onClick={() => setLangOpen((v) => !v)} aria-expanded={langOpen}>
                <Flag code={lang} /> {lang === 'E' ? 'EN' : 'VN'}
              </button>
              {langOpen && (
                <div className="lg__lang-pop">
                  <button type="button" className={lang === 'V' ? 'is-on' : ''} onClick={() => pickLang('V')}><Flag code="V" /> Tiếng Việt</button>
                  <button type="button" className={lang === 'E' ? 'is-on' : ''} onClick={() => pickLang('E')}><Flag code="E" /> English</button>
                </div>
              )}
            </div>
          </div>

          <h2 className="lg__title">{t.welcome}</h2>
          <p className="lg__sub">{t.sub}</p>

          {message && (
            <div className={`lg__msg lg__msg--${message.type}`} role="alert">
              <Icon name="warning" size={15} /> {message.text}
            </div>
          )}

          <fieldset className="lg__fields" disabled={busy}>
            <CyberTextBox
              {...form.bind('UserName')}
              id="login-user" layout="vertical" label={t.user} name="username" autoComplete="username"
              autoFocus={!form.data.UserName} placeholder={t.userPh} error={shownErrors.UserName}
              onBlur={(e) => loadUnits(e.target.value)}
              onEnter={() => document.getElementById('login-pass')?.focus()}
            />
            <CyberTextBox
              {...form.bind('Password')}
              id="login-pass" layout="vertical" label={t.pass} name="password" type={showPass ? 'text' : 'password'}
              autoComplete="current-password" autoFocus={!!form.data.UserName} placeholder={t.passPh}
              error={shownErrors.Password} onKeyUp={(e) => setCapsLock(!!e.getModifierState?.('CapsLock'))}
              addon={
                <button type="button" className="lg__eye" tabIndex={-1}
                  title={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPass((v) => !v)}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} size={17} />
                </button>
              }
            />
            {capsLock && <div className="lg__caps"><Icon name="warning" size={13} /> {t.caps}</div>}
            <CyberSelect
              {...form.bind('MaTTCP')}
              layout="vertical" label={t.unit}
              dataSource={units} valueField="Ma_TTCP" displayField="Ten_TTCP"
              groupField="Ma_Dvcs" groupLabel={(g) => `${t.group} ${g}`} showValue
              loading={unitsLoading} loadingText={t.unitLoading}
              placeholder={units.length ? t.unitPick : t.unitPh}
              disabled={!units.length && !unitsLoading}
              error={unitError || shownErrors.MaTTCP}
            />
          </fieldset>

          <div className="lg__forgot">
            {BRAND.forgotPasswordUrl
              ? <a href={BRAND.forgotPasswordUrl} target="_blank" rel="noreferrer">{t.forgot}</a>
              : <button type="button" onClick={() => setMessage({ type: 'info', text: t.forgotMsg })}>{t.forgot}</button>}
          </div>

          <button ref={btnRef} type="submit" className={`lg__submit is-${phase === 'leave' ? 'reveal' : phase}`} disabled={busy}
            aria-label={phase === 'idle' ? t.login : phase === 'loading' ? t.loading : t.ok} aria-live="polite">
            <span className="lg__submit-face lg__submit-face--idle" aria-hidden="true">{t.login}</span>
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
                    onClick={() => setMessage({ type: 'info', text: t.social(s.text) })}>
                    <SocialIcon name={s.key} /> {s.text}
                  </button>
                ))}
              </div>
            </>
          )}

          {apiConfig.USE_MOCK && <p className="lg__hint">Dữ liệu giả: mật khẩu <b>123</b></p>}
          <footer className="lg__foot">{BRAND.copyright}©{new Date().getFullYear()} - Version: {BRAND.version}</footer>
        </form>
      </main>

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
