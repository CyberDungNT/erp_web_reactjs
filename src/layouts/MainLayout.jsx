import {
  Component,
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { apiConfig } from "@/api/apiClient";
import { getMenuRows, markLogoutFx } from "@/auth/authService";
import { LOCAL_KEYS, localStore } from "@/utils/storage";
import { buildMenuTree } from "@/utils/menuTree";
import {
  screens,
  Placeholder,
  devMenu,
  SHOW_DEV_MENU,
  EXIT_MENU_IDS,
  LANG_MENU_IDS,
  HomePage,
  moduleWidgets,
} from "@/screens/registry";
import { CyberContextMenu, msgbox } from "@/components/cyber";
import Icon from "@/components/icons/Icon";
import { BRAND } from "@/config/brand";
import MenuStrip from "./MenuStrip";
import SideMenu from "./SideMenu";
import UnitSwitcher from "./UnitSwitcher";
import TaskBar from "./TaskBar";
import "./main.css";

const SIDEBAR_KEY = LOCAL_KEYS.SIDEBAR_COLLAPSED;
const SIDEBAR_W_KEY = LOCAL_KEYS.SIDEBAR_WIDTH;
const SIDE_DEFAULT = 264;
const SIDE_MIN = 200;
const SIDE_MAX = 480;
const BYE_MS = 620; // thời gian hiệu ứng đăng xuất trước khi về màn login
const SIDE_COLLAPSE_AT = 130; // kéo nhỏ hơn mức này thì tự thu gọn thành dạng icon
const clampSide = (w) => Math.round(Math.min(SIDE_MAX, Math.max(SIDE_MIN, w)));

const USER_TEXT = {
  V: {
    admin: "Quản trị viên",
    member: "Người dùng",
    lockDate: "Ngày khoá sổ",
    mock: "Đang dùng dữ liệu giả",
    lang: "Ngôn ngữ",
    account: "Thông tin tài khoản",
    fs: "Toàn màn hình",
    exitFs: "Thoát toàn màn hình",
    collapseSide: "Thu gọn menu trái",
    expandSide: "Mở rộng menu trái",
    keys: "Phím tắt",
    reload: "Tải lại ứng dụng",
    about: "Giới thiệu phần mềm",
    logout: "Đăng xuất",
    userName: "Tài khoản",
    company: "Công ty",
    unit: "Đơn vị",
    role: "Vai trò",
    version: "Phiên bản",
    reloadAsk: "Tải lại ứng dụng?",
    reloadDetail: (n) =>
      `${n} cửa sổ đang mở sẽ bị đóng, dữ liệu chưa lưu sẽ bị mất.`,
    keysMsg: "Các phím tắt dùng trong màn hình chính",
    keysList: [
      "Alt / F10 — Kích hoạt thanh menu trên",
      "Alt + chữ gạch chân — Mở nhanh menu",
      "← → ↑ ↓ / Enter / Esc — Điều hướng menu",
      "Ctrl + Alt + W — Đóng cửa sổ đang mở",
      "Chuột giữa trên thanh dưới — Đóng cửa sổ",
      "F11 — Toàn màn hình",
    ],
  },
  E: {
    admin: "Administrator",
    member: "User",
    lockDate: "Lock date",
    mock: "Using mock data",
    lang: "Language",
    account: "Account information",
    fs: "Full screen",
    exitFs: "Exit full screen",
    collapseSide: "Collapse sidebar",
    expandSide: "Expand sidebar",
    keys: "Keyboard shortcuts",
    reload: "Reload application",
    about: "About",
    logout: "Sign out",
    userName: "Username",
    company: "Company",
    unit: "Unit",
    role: "Role",
    version: "Version",
    reloadAsk: "Reload the application?",
    reloadDetail: (n) =>
      `${n} open window(s) will be closed and unsaved data will be lost.`,
    keysMsg: "Shortcuts available on the main screen",
    keysList: [
      "Alt / F10 — Activate the top menu",
      "Alt + underlined letter — Open a menu",
      "← → ↑ ↓ / Enter / Esc — Navigate menus",
      "Ctrl + Alt + W — Close the active window",
      "Middle click on the taskbar — Close a window",
      "F11 — Full screen",
    ],
  },
};
const HOME = "HOME";

/** Dữ liệu dùng chung cho các trang trong màn chính: useMain() */
const MainContext = createContext(null);
export const useMain = () => useContext(MainContext);

/**
 * MÀN HÌNH CHÍNH
 *  ┌ thanh trên: ☰ logo | menu (MenuStrip, bảng MENU_TABLE.top) | người dùng
 *  ├ trái: tìm chức năng + cây menu (bảng MENU_TABLE.left) + thẻ "Đơn vị làm việc"
 *  └ vùng làm việc:
 *      - "Trang chủ": hàng tab dashboard (bảng PageName: HOME, LỊCH HẸN...) + nội dung tab
 *      - cửa sổ chức năng mở từ menu
 *      - thanh dưới: "Trang chủ" + các cửa sổ đang mở | ngày khoá sổ
 */
export default function MainLayout() {
  const { session, user, lang, logout, setLang } = useAuth();

  // Vừa đăng nhập thành công -> chạy hiệu ứng mở màn chính 1 lần (thanh trên, menu, vùng làm việc lần lượt hiện ra)
  const location = useLocation();
  const navigate = useNavigate();
  const [intro, setIntro] = useState(() => !!location.state?.intro);
  const [bye, setBye] = useState(false); // đang chạy hiệu ứng đăng xuất
  useEffect(() => {
    if (!intro) return undefined;
    navigate(location.pathname, { replace: true, state: null }); // F5 sau đó không chạy lại hiệu ứng
    const t = setTimeout(() => setIntro(false), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menuRows = useMemo(() => getMenuRows(session), [session]);
  const topTree = useMemo(
    () => buildMenuTree(menuRows.top, lang),
    [menuRows, lang],
  );
  const leftTree = useMemo(() => {
    const t = buildMenuTree(menuRows.left, lang);
    return SHOW_DEV_MENU ? [...t, ...devMenu] : t;
  }, [menuRows, lang]);

  const nodeMap = useMemo(() => {
    const m = new Map();
    const walk = (list) =>
      list.forEach((n) => {
        if (!m.has(n.id)) m.set(n.id, n);
        walk(n.children);
      });
    walk(leftTree);
    walk(topTree);
    return m;
  }, [leftTree, topTree]);

  const [windows, setWindows] = useState([]); // cửa sổ chức năng đang mở [{ key, node }]
  const [activeKey, setActiveKey] = useState(HOME); // HOME = trang chủ (dashboard biểu đồ), còn lại = Menu_Id
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStore.get(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [ctxMenu, setCtxMenu] = useState(null);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    try {
      localStore.set(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // ----- Kéo cạnh phải menu trái để đổi độ rộng (nhớ lại cho lần sau) -----
  const [sideW, setSideW] = useState(() => {
    try {
      return clampSide(
        Number(localStore.get(SIDEBAR_W_KEY)) || SIDE_DEFAULT,
      );
    } catch {
      return SIDE_DEFAULT;
    }
  });
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    try {
      localStore.set(SIDEBAR_W_KEY, String(sideW));
    } catch {
      /* ignore */
    }
  }, [sideW]);
  const startResize = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = sideW;
    setResizing(true);
    const move = (ev) => {
      const raw = startW + ev.clientX - startX;
      if (raw < SIDE_COLLAPSE_AT) {
        up();
        setSideW(startW);
        setCollapsed(true);
        return;
      } // kéo quá nhỏ -> thu gọn
      setSideW(clampSide(raw));
    };
    const up = () => {
      setResizing(false);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };
  const onResizeKey = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSideW((w) => clampSide(w - 16));
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setSideW((w) => clampSide(w + 16));
    }
    if (e.key === "Home" || e.key === "Enter") {
      e.preventDefault();
      setSideW(SIDE_DEFAULT);
    }
  };
  useEffect(() => {
    if (user?.Title) document.title = user.Title;
  }, [user?.Title]);
  useEffect(() => {
    if (!userOpen) return;
    const close = (e) => {
      if (!userRef.current?.contains(e.target)) setUserOpen(false);
    };
    const esc = (e) => e.key === "Escape" && setUserOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [userOpen]);

  // Theo dõi chế độ toàn màn hình (F11 / nút trong menu người dùng)
  const [fullscreen, setFullscreen] = useState(
    () => !!document.fullscreenElement,
  );
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const toggleLang = useCallback(
    () => setLang(lang === "E" ? "V" : "E"),
    [lang, setLang],
  );
  const doLogout = useCallback(async () => {
    const E = lang === "E";
    const ok = await msgbox.yesNo(
      E ? "Are you sure you want to sign out?" : "Bạn có chắc muốn đăng xuất?",
      {
        lang,
        title: E ? "Sign out" : "Đăng xuất",
        detail: E
          ? "Open windows will be closed and unsaved data will be lost."
          : "Các cửa sổ đang mở sẽ được đóng, dữ liệu chưa lưu sẽ bị mất.",
        yesText: E ? "Sign out" : "Đăng xuất",
        noText: E ? "Cancel" : "Huỷ",
        danger: true,
      },
    );
    if (!ok) return;
    // Hiệu ứng đăng xuất: màn chính thu lại, lớp màu phủ kín rồi mới về login (login chạy tiếp hiệu ứng mở ra)
    setBye(true);
    setTimeout(() => {
      markLogoutFx();
      logout();
    }, BYE_MS);
  }, [logout, lang]);

  /** Mở 1 chức năng từ menu / trang chủ */
  const openMenu = useCallback(
    (node) => {
      if (!node || node.separator || node.children?.length) return;
      if (
        EXIT_MENU_IDS.includes(node.id) ||
        String(node.icon).toUpperCase() === "EXIT"
      )
        return doLogout();
      if (LANG_MENU_IDS.includes(node.id)) return toggleLang();
      setWindows((ws) =>
        ws.some((w) => w.key === node.id)
          ? ws
          : [...ws, { key: node.id, node }],
      );
      setActiveKey(node.id);
    },
    [doLogout, toggleLang],
  );

  const closeWindows = useCallback(
    (keys) => {
      const next = windows.filter((w) => !keys.includes(w.key));
      setWindows(next);
      if (keys.includes(activeKey)) {
        const idx = windows.findIndex((w) => w.key === activeKey);
        setActiveKey(next[Math.min(idx, next.length - 1)]?.key || HOME);
      }
    },
    [windows, activeKey],
  );

  // Ctrl+Alt+W: đóng cửa sổ đang mở
  useEffect(() => {
    const onKey = (e) => {
      if (
        e.ctrlKey &&
        e.altKey &&
        e.key.toLowerCase() === "w" &&
        activeKey !== HOME
      ) {
        e.preventDefault();
        closeWindows([activeKey]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeKey, closeWindows]);

  const winTitle = (w) => nodeMap.get(w.key)?.text || w.node?.text;

  const onWindowContext = (e, w) => {
    e.preventDefault();
    const others = windows.filter((x) => x.key !== w.key).map((x) => x.key);
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          text: "Đóng",
          icon: "✕",
          shortcut: "Ctrl+Alt+W",
          onClick: () => closeWindows([w.key]),
        },
        {
          text: "Đóng các cửa sổ khác",
          disabled: !others.length,
          onClick: () => closeWindows(others),
        },
        {
          text: "Đóng tất cả",
          onClick: () => closeWindows(windows.map((x) => x.key)),
        },
      ],
    });
  };

  const ctx = useMemo(
    () => ({ leftTree, topTree, nodeMap, openMenu, lang }),
    [leftTree, topTree, nodeMap, openMenu, lang],
  );
  const displayName = user?.Comment || user?.User_name || "";
  const initial =
    displayName.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || "?";
  const UT = USER_TEXT[lang === "E" ? "E" : "V"];

  // ----- Chức năng trong menu người dùng -----
  const showAccount = () =>
    msgbox.info(displayName, {
      lang,
      title: UT.account,
      detail: [
        `${UT.userName}: ${user?.User_name || ""}`,
        user?.EMail && `Email: ${user.EMail}`,
        `${UT.company}: ${user?.Ten_Dvcs || ""}`,
        `${UT.unit}: ${user?.Ten_TTCP || ""} (${user?.Ma_TTCP || ""})`,
        user?.Ngay_Ks && `${UT.lockDate}: ${user.Ngay_Ks}`,
        `${UT.role}: ${user?.is_Admin ? UT.admin : UT.member}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  const showShortcuts = () =>
    msgbox.info(UT.keysMsg, {
      lang,
      title: UT.keys,
      detail: UT.keysList.join("\n"),
    });
  const showAbout = () =>
    msgbox.info(`${BRAND.product} – ${UT.version} ${BRAND.version}`, {
      lang,
      title: UT.about,
      detail: [user?.Ten_Dvcs || BRAND.company, BRAND.watermark].filter(Boolean).join("\n"),
    });
  const reloadApp = async () => {
    const ok = await msgbox.yesNo(UT.reloadAsk, {
      lang,
      title: UT.reload,
      detail: windows.length ? UT.reloadDetail(windows.length) : undefined,
    });
    if (ok) window.location.reload();
  };

  return (
    <MainContext.Provider value={ctx}>
      <div
        className={`mn ${collapsed ? "mn--collapsed" : ""} ${intro ? "mn--intro" : ""} ${resizing ? "mn--resizing" : ""} ${bye ? "mn--bye" : ""}`}
        style={{ "--side-w-open": `${sideW}px` }}
      >
        {/* ---------- Thanh trên ---------- */}
        <header className="mn__top">
          <button
            type="button"
            className="mn__burger"
            title={collapsed ? "Mở menu" : "Thu gọn menu"}
            onClick={() => setCollapsed((c) => !c)}
          >
            <Icon name="menu" size={20} />
          </button>
          <div className="mn__logo" title={user?.Title}>
            {/* <b>{BRAND.appName.main}</b>
            <span>{BRAND.appName.sub}</span> */}
            <b>Logo</b>
            <span>version</span>
          </div>
          <div className="mn__menu">
            <MenuStrip tree={topTree} onOpen={openMenu} variant="header" />
          </div>
          <div className="mn__user" ref={userRef}>
            <button
              type="button"
              className="mn__user-btn"
              onClick={() => setUserOpen((v) => !v)}
              aria-expanded={userOpen}
            >
              <span className="mn__avatar">{initial}</span>
              <span className="mn__user-text">
                <b>{displayName}</b>
                <small>
                  {user?.User_name}
                  {user?.is_Admin ? " · Quản trị" : ""}
                </small>
              </span>
              <Icon name="chevronDown" size={16} />
            </button>
            {userOpen && (
              <div className="mn__user-pop" role="menu">
                <div className="mn__user-head">
                  <span className="mn__avatar mn__avatar--lg">
                    {initial}
                    <i className="mn__online" />
                  </span>
                  <div className="mn__user-id">
                    <b>{displayName}</b>
                    <small>{user?.EMail || user?.User_name}</small>
                    <span className="mn__role">
                      {user?.is_Admin ? UT.admin : UT.member}
                    </span>
                  </div>
                </div>

                <div className="mn__user-info">
                  <div className="mn__user-row">
                    <Icon name="building" size={14} />{" "}
                    <span>{user?.Ten_Dvcs}</span>
                  </div>
                  <div className="mn__user-row">
                    <Icon name="briefcase" size={14} />{" "}
                    <span>{user?.Ten_TTCP}</span>
                  </div>
                  {user?.Ngay_Ks && (
                    <div className="mn__user-row">
                      <Icon name="lock" size={14} />{" "}
                      <span>
                        {UT.lockDate}: {user.Ngay_Ks}
                      </span>
                    </div>
                  )}
                  {apiConfig.USE_MOCK && (
                    <div className="mn__user-row">
                      <span className="badge badge--warn">MOCK</span> {UT.mock}
                    </div>
                  )}
                </div>

                <div className="mn__user-sec">
                  <div className="mn__user-label">
                    <Icon name="globe" size={14} /> {UT.lang}
                  </div>
                  <div
                    className={`mn__seg ${lang === "E" ? "is-right" : ""}`}
                    role="radiogroup"
                    aria-label={UT.lang}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={lang !== "E"}
                      className={lang !== "E" ? "is-on" : ""}
                      onClick={() => setLang("V")}
                    >
                      Tiếng Việt
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={lang === "E"}
                      className={lang === "E" ? "is-on" : ""}
                      onClick={() => setLang("E")}
                    >
                      English
                    </button>
                  </div>
                </div>

                <div className="mn__user-list">
                  <button
                    type="button"
                    role="menuitem"
                    className="mn__user-act"
                    onClick={() => {
                      setUserOpen(false);
                      showAccount();
                    }}
                  >
                    <Icon name="user" size={16} /> <span>{UT.account}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="mn__user-act"
                    onClick={toggleFullscreen}
                  >
                    <Icon name={fullscreen ? "shrink" : "expand"} size={16} />{" "}
                    <span>{fullscreen ? UT.exitFs : UT.fs}</span>
                    <kbd>F11</kbd>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="mn__user-act"
                    onClick={() => setCollapsed((c) => !c)}
                  >
                    <Icon name="sidebar" size={16} />{" "}
                    <span>{collapsed ? UT.expandSide : UT.collapseSide}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="mn__user-act"
                    onClick={() => {
                      setUserOpen(false);
                      showShortcuts();
                    }}
                  >
                    <Icon name="keyboard" size={16} /> <span>{UT.keys}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="mn__user-act"
                    onClick={() => {
                      setUserOpen(false);
                      reloadApp();
                    }}
                  >
                    <Icon name="refresh" size={16} /> <span>{UT.reload}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="mn__user-act"
                    onClick={() => {
                      setUserOpen(false);
                      showAbout();
                    }}
                  >
                    <Icon name="info" size={16} /> <span>{UT.about}</span>
                  </button>
                </div>

                <div className="mn__user-foot">
                  <button
                    type="button"
                    role="menuitem"
                    className="mn__user-act is-danger"
                    onClick={() => {
                      setUserOpen(false);
                      doLogout();
                    }}
                  >
                    <Icon name="exit" size={16} /> <span>{UT.logout}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ---------- Menu trái ---------- */}
        <aside className="mn__side">
          <SideMenu
            tree={leftTree}
            activeId={activeKey}
            collapsed={collapsed}
            onExpand={() => setCollapsed(false)}
            onOpen={openMenu}
          />
          <UnitSwitcher collapsed={collapsed} />
        </aside>
        {!collapsed && (
          <div
            className="mn__resizer"
            role="separator"
            aria-orientation="vertical"
            tabIndex={0}
            aria-valuemin={SIDE_MIN}
            aria-valuemax={SIDE_MAX}
            aria-valuenow={sideW}
            title={
              lang === "E"
                ? "Drag to resize · Double-click to reset"
                : "Kéo để đổi độ rộng · Nhấp đúp để về mặc định"
            }
            onPointerDown={startResize}
            onDoubleClick={() => setSideW(SIDE_DEFAULT)}
            onKeyDown={onResizeKey}
          >
            <i />
          </div>
        )}

        {/* ---------- Vùng làm việc ---------- */}
        <section className="mn__work">
          <div className="mn__content">
            {/* Trang chủ: 1 dashboard biểu đồ duy nhất (registry.HomePage) */}
            <div className="mn__pane" hidden={activeKey !== HOME}>
              <PaneBoundary>
                <Suspense
                  fallback={<div className="mn__loading">Đang tải...</div>}
                >
                  <HomePage />
                </Suspense>
              </PaneBoundary>
            </div>
            {windows.map((w) => {
              const Screen = screens[w.key] || Placeholder;
              return (
                <div
                  key={w.key}
                  className="mn__pane"
                  hidden={activeKey !== w.key}
                >
                  <PaneBoundary>
                    <Suspense
                      fallback={
                        <div className="mn__loading">Đang tải màn hình...</div>
                      }
                    >
                      <Screen menu={nodeMap.get(w.key) || w.node} />
                    </Suspense>
                  </PaneBoundary>
                </div>
              );
            })}
            {BRAND.watermark && (
              <div className="mn__watermark" aria-hidden="true">
                {BRAND.watermark}
              </div>
            )}
          </div>

          <TaskBar
            windows={windows}
            activeKey={activeKey}
            homeKey={HOME}
            titleOf={winTitle}
            onActivate={setActiveKey}
            onClose={closeWindows}
            onReorder={setWindows}
            onContextMenu={onWindowContext}
            lang={lang}
            lockDate={user?.Ngay_Ks}
          />
        </section>

        {ctxMenu && (
          <CyberContextMenu {...ctxMenu} onClose={() => setCtxMenu(null)} />
        )}

        {/* Thành phần chạy nền của các module (popup tin nhắn...) – khai báo "widgets" trong index.js của từng phân hệ */}
        <Suspense fallback={null}>
          {moduleWidgets.map((Widget, i) => <PaneBoundary key={i} silent><Widget /></PaneBoundary>)}
        </Suspense>
      </div>
      {bye && (
        <div className="mn-bye" role="status">
          <div className="mn-bye__inner">
            <span className="mn-bye__spin" aria-hidden="true" />
            {lang === "E" ? "Signing out…" : "Đang đăng xuất…"}
          </div>
        </div>
      )}
    </MainContext.Provider>
  );
}

/** Lỗi trong 1 màn hình chỉ làm hỏng màn đó, không sập cả app */
class PaneBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      if (this.props.silent) return null; // widget nền lỗi: ẩn đi, không làm hỏng màn chính
      return (
        <div className="page">
          <div className="alert alert--error">
            Màn hình gặp lỗi:{" "}
            {String(this.state.error.message || this.state.error)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
