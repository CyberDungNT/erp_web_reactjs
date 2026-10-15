import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiConfig } from '../api/apiClient';
import { buildMenuTree } from '../utils/menuTree';
import { screens, Placeholder, devMenu, SHOW_DEV_MENU, EXIT_MENU_IDS, LANG_MENU_IDS } from '../screens/registry';
import { CyberContextMenu } from '../components/cyber';
import Icon from '../components/icons/Icon';
import TopMenu from './TopMenu';
import SideMenu from './SideMenu';
import './main.css';

const HOME_TAB = { key: 'HOME', closable: false };
const SIDEBAR_KEY = 'cyber_sidebar_collapsed';

/**
 * Màn hình chính sau đăng nhập:
 *  - Thanh trên: logo, menu phân hệ (bảng 0), ngôn ngữ, người dùng
 *  - Bên trái: cây menu (bảng 1)
 *  - Giữa: các tab chức năng (giữ nguyên trạng thái khi chuyển tab)
 *  - Dưới: thanh trạng thái
 */
export default function MainLayout() {
  const { session, user, lang, logout, setLang } = useAuth();

  const topTree = useMemo(() => buildMenuTree(session.topMenu, lang), [session.topMenu, lang]);
  const leftTree = useMemo(() => {
    const t = buildMenuTree(session.leftMenu, lang);
    return SHOW_DEV_MENU ? [...t, ...devMenu] : t;
  }, [session.leftMenu, lang]);

  // Tra cứu node theo Menu_Id để tiêu đề tab đổi theo ngôn ngữ
  const nodeMap = useMemo(() => {
    const m = new Map();
    const walk = (list) => list.forEach((n) => { if (!m.has(n.id)) m.set(n.id, n); walk(n.children); });
    walk(leftTree);
    walk(topTree);
    return m;
  }, [leftTree, topTree]);

  const [tabs, setTabs] = useState([HOME_TAB]);
  const [activeKey, setActiveKey] = useState('HOME');
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  const [tabMenu, setTabMenu] = useState(null);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef(null);
  const tabBarRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    if (!userOpen) return;
    const close = (e) => { if (!userRef.current?.contains(e.target)) setUserOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [userOpen]);

  // Cuộn tab đang chọn vào tầm nhìn
  useEffect(() => {
    tabBarRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeKey]);

  const toggleLang = useCallback(() => setLang(lang === 'E' ? 'V' : 'E'), [lang, setLang]);

  const doLogout = useCallback(() => {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) logout();
  }, [logout]);

  /** Mở 1 chức năng từ menu */
  const openMenu = useCallback((node) => {
    if (!node || node.separator || node.children?.length) return;
    if (EXIT_MENU_IDS.includes(node.id) || String(node.icon).toUpperCase() === 'EXIT') return doLogout();
    if (LANG_MENU_IDS.includes(node.id)) return toggleLang();
    setTabs((ts) => (ts.some((t) => t.key === node.id) ? ts : [...ts, { key: node.id, closable: true, node }]));
    setActiveKey(node.id);
  }, [doLogout, toggleLang]);

  const closeTabs = useCallback((keys) => {
    const next = tabs.filter((t) => !t.closable || !keys.includes(t.key));
    setTabs(next);
    if (!next.some((t) => t.key === activeKey)) {
      const idx = tabs.findIndex((t) => t.key === activeKey);
      setActiveKey((next[Math.min(idx, next.length - 1)] || next[0]).key);
    }
  }, [tabs, activeKey]);

  // Phím tắt: Ctrl+Alt+W đóng tab hiện tại
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'w' && activeKey !== 'HOME') {
        e.preventDefault();
        closeTabs([activeKey]);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeKey, closeTabs]);

  const tabTitle = (t) => (t.key === 'HOME' ? (lang === 'E' ? 'Home' : 'Trang chủ') : nodeMap.get(t.key)?.text || t.node?.text);

  const onTabContext = (e, t) => {
    e.preventDefault();
    const others = tabs.filter((x) => x.closable && x.key !== t.key).map((x) => x.key);
    const all = tabs.filter((x) => x.closable).map((x) => x.key);
    setTabMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { text: 'Đóng tab', icon: '✕', shortcut: 'Ctrl+Alt+W', disabled: !t.closable, onClick: () => closeTabs([t.key]) },
        { text: 'Đóng các tab khác', disabled: others.length === 0, onClick: () => closeTabs(others) },
        { text: 'Đóng tất cả', disabled: all.length === 0, onClick: () => closeTabs(all) },
      ],
    });
  };

  const renderScreen = (t) => {
    const node = t.key === 'HOME' ? { id: 'HOME', text: tabTitle(t) } : nodeMap.get(t.key) || t.node;
    const Screen = screens[t.key] || Placeholder;
    return (
      <TabErrorBoundary>
        <Suspense fallback={<div className="main__loading">Đang tải màn hình...</div>}>
          <Screen menu={node} />
        </Suspense>
      </TabErrorBoundary>
    );
  };

  return (
    <div className={`main ${collapsed ? 'main--collapsed' : ''}`}>
      <header className="main__top">
        <button type="button" className="main__burger" title={collapsed ? 'Mở menu' : 'Thu gọn menu'}
          onClick={() => setCollapsed((c) => !c)}>
          <Icon name="menu" size={18} />
        </button>
        <div className="main__logo" title={user?.Title}>
          <span className="main__logo-mark">C</span>
          <span className="main__logo-text">Cyber<b>Plus</b></span>
        </div>
        <TopMenu tree={topTree} onOpen={openMenu} />
        <div className="main__right">
          {apiConfig.USE_MOCK && <span className="badge badge--warn" title="VITE_USE_MOCK=true">Mock</span>}
          <button type="button" className="main__lang" onClick={toggleLang} title="Đổi ngôn ngữ">
            <Icon name="globe" size={15} /> {lang === 'E' ? 'EN' : 'VI'}
          </button>
          <div className="main__user" ref={userRef}>
            <button type="button" className="main__user-btn" onClick={() => setUserOpen((v) => !v)} aria-expanded={userOpen}>
              <span className="main__avatar">{(user?.User_name || '?').charAt(0).toUpperCase()}</span>
              <span className="main__user-name">{user?.User_name}</span>
              <Icon name="chevronDown" size={12} />
            </button>
            {userOpen && (
              <div className="main__user-pop">
                <div className="main__user-head">
                  <span className="main__avatar main__avatar--lg">{(user?.User_name || '?').charAt(0).toUpperCase()}</span>
                  <div>
                    <b>{user?.User_name}</b>
                    <div className="cy-muted">{user?.Comment}{user?.is_Admin ? ' · Quản trị' : ''}</div>
                    {user?.EMail && <div className="cy-muted">{user.EMail}</div>}
                  </div>
                </div>
                <div className="main__user-row"><Icon name="building" size={14} /> {user?.Ten_TTCP}</div>
                <button type="button" className="main__user-act" onClick={() => { setUserOpen(false); toggleLang(); }}>
                  <Icon name="globe" size={14} /> {lang === 'E' ? 'Giao diện tiếng Việt' : 'English interface'}
                </button>
                <button type="button" className="main__user-act is-danger" onClick={() => { setUserOpen(false); doLogout(); }}>
                  <Icon name="exit" size={14} /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <aside className="main__side">
        <SideMenu tree={leftTree} activeId={activeKey} collapsed={collapsed}
          onExpand={() => setCollapsed(false)} onOpen={openMenu} />
      </aside>

      <section className="main__work">
        <div className="main__tabs" ref={tabBarRef} role="tablist">
          {tabs.map((t) => (
            <div key={t.key} role="tab" aria-selected={activeKey === t.key}
              className={`main__tab ${activeKey === t.key ? 'is-active' : ''}`}
              onClick={() => setActiveKey(t.key)}
              onMouseDown={(e) => { if (e.button === 1 && t.closable) { e.preventDefault(); closeTabs([t.key]); } }}
              onContextMenu={(e) => onTabContext(e, t)}
              title={t.key === 'HOME' ? '' : `${tabTitle(t)} (${t.key})`}>
              {t.key === 'HOME' && <Icon name="home" size={14} />}
              <span className="main__tab-text">{tabTitle(t)}</span>
              {t.closable && (
                <button type="button" className="main__tab-close" title="Đóng"
                  onClick={(e) => { e.stopPropagation(); closeTabs([t.key]); }}>
                  <Icon name="close" size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="main__content">
          {tabs.map((t) => (
            <div key={t.key} className="main__pane" hidden={activeKey !== t.key}>
              {renderScreen(t)}
            </div>
          ))}
        </div>
      </section>

      <footer className="main__status">
        <span>{user?.Ten_Dvcs}</span>
        <span>ĐV: {user?.Ma_Dvcs}/{user?.Ma_TTCP}</span>
        <span>Khoá sổ: {user?.Ngay_Ks}</span>
        <span className="main__status-right">{user?.Version}</span>
      </footer>

      {tabMenu && <CyberContextMenu {...tabMenu} onClose={() => setTabMenu(null)} />}
    </div>
  );
}

/** Lỗi trong 1 màn hình chỉ làm hỏng tab đó, không sập cả app */
class TabErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="alert alert--error">Màn hình gặp lỗi: {String(this.state.error.message || this.state.error)}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
