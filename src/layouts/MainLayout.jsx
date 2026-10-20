import {
  Component,
  Suspense,
  lazy,
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
import { ScreenContext } from "@/hooks/screenContext";
import { clearAllDrafts } from "@/utils/draftStore";
import { THEMES, useTheme } from "@/utils/theme";
import { clearPushOnLogout } from "@/realtime/push";
import { decryptText, encryptText } from "@/auth/tokenVault";
import { buildMenuTree } from "@/utils/menuTree";
import {
  devMenu,
  SHOW_DEV_MENU,
  EXIT_MENU_IDS,
  LANG_MENU_IDS,
  HomePage,
  moduleWidgets,
  moduleUserMenu,
  screens as STATIC_SCREENS,
} from "@/screens/registry";
import { getMenuInfo, isMenuAllowed, forgetMenuInfo } from "@/screens/menuForm";
// Cửa sổ chức năng: màn khai báo cứng (registry) hoặc gọi CP_SysGetMenu -> FormInPut -> mở file cùng tên
import MenuScreen from "@/screens/MenuScreen";
import { CyberContextMenu, msgbox, toast } from "@/components/cyber";
import Icon from "@/components/icons/Icon";
import { BRAND } from "@/config/brand";
import MenuStrip from "./MenuStrip";
import SideMenu from "./SideMenu";
import UnitSwitcher from "./UnitSwitcher";
import TaskBar from "./TaskBar";
import { APP_BUILD, watchNewVersion } from "@/utils/appVersion";
// Cập nhật hệ thống (menu avatar, chỉ quản trị) – tải code khi mở
const DeployPanel = lazy(() => import("./DeployPanel"));
// Popup tài khoản (đổi mật khẩu, ảnh đại diện) – nạp khi mở
const ChangePasswordPopup = lazy(() => import("./AccountPopups").then((m) => ({ default: m.ChangePasswordPopup })));
const AvatarPopup = lazy(() => import("./AccountPopups").then((m) => ({ default: m.AvatarPopup })));
import AvatarImage from "./AvatarImage";
import "./main.css";

const SIDEBAR_KEY = LOCAL_KEYS.SIDEBAR_COLLAPSED;
const SIDEBAR_W_KEY = LOCAL_KEYS.SIDEBAR_WIDTH;
const SIDE_DEFAULT = 264;
const MOBILE_MQ = "(max-width: 800px)"; // khớp @media (max-width: 800px) trong main.css
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
    appVer: "Phiên bản",
    devBuild: "bản dev",
    mock: "Đang dùng dữ liệu giả",
    lang: "Ngôn ngữ",
    theme: "Giao diện",
    themes: { light: "Sáng", dark: "Tối", system: "Theo máy" },
    toDark: "Chuyển sang giao diện tối",
    toLight: "Chuyển sang giao diện sáng",
    account: "Thông tin tài khoản",
    changePw: "Đổi mật khẩu",
    avatar: "Đổi ảnh đại diện",
    avatarEdit: "Đổi ảnh",
    fs: "Toàn màn hình",
    exitFs: "Thoát toàn màn hình",
    collapseSide: "Thu gọn menu trái",
    expandSide: "Mở rộng menu trái",
    keys: "Phím tắt",
    reload: "Tải lại ứng dụng",
    about: "Giới thiệu phần mềm",
    deploy: "Cập nhật hệ thống",
    goHome: "Về trang chủ",
    newVersion: "Đã có phiên bản mới của phần mềm.",
    newVersionAct: "Tải lại",
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
    appVer: "Version",
    devBuild: "dev build",
    mock: "Using mock data",
    lang: "Language",
    theme: "Appearance",
    themes: { light: "Light", dark: "Dark", system: "System" },
    toDark: "Switch to dark mode",
    toLight: "Switch to light mode",
    account: "Account information",
    changePw: "Change password",
    avatar: "Change profile picture",
    avatarEdit: "Edit",
    fs: "Full screen",
    exitFs: "Exit full screen",
    collapseSide: "Collapse sidebar",
    expandSide: "Expand sidebar",
    keys: "Keyboard shortcuts",
    reload: "Reload application",
    about: "About",
    deploy: "System update",
    goHome: "Go to home",
    newVersion: "A new version of the app is available.",
    newVersionAct: "Reload",
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
  const { pref: themePref, theme, setPref: setThemePref, toggle: toggleTheme } = useTheme();

  // Vừa đăng nhập thành công -> chạy hiệu ứng mở màn chính 1 lần (thanh trên, menu, vùng làm việc lần lượt hiện ra)
  const location = useLocation();
  const navigate = useNavigate();
  const [intro, setIntro] = useState(() => !!location.state?.intro);
  const [bye, setBye] = useState(false); // đang chạy hiệu ứng đăng xuất
  useEffect(() => {
    if (!intro) return undefined;
    navigate(location.pathname + location.search, { replace: true, state: null }); // F5 sau đó không chạy lại hiệu ứng
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

  // ----- Cửa sổ đang mở nằm trên URL (ĐÃ MÃ HOÁ): /?s=<AES-GCM> -> F5 / phải đăng nhập lại vẫn mở đúng chức năng -----
  // Nội dung gốc "w=ID1,ID2&f=ID2" được mã hoá bằng khoá của trình duyệt (tokenVault, giống cyber_auth):
  // nhìn URL không biết đang mở chức năng gì; copy URL sang trình duyệt khác -> không giải mã được -> về trang chủ.
  const [windows, setWindows] = useState([]); // cửa sổ chức năng đang mở [{ key, node }]
  const [activeKey, setActiveKey] = useState(HOME); // HOME = trang chủ (dashboard biểu đồ), còn lại = Menu_Id
  // openMenu đọc giá trị mới nhất qua ref (không tạo lại hàm mỗi lần mở/đóng cửa sổ)
  const windowsRef = useRef(windows);
  windowsRef.current = windows;
  const authUserRef = useRef(user);
  authUserRef.current = user;
  const openingRef = useRef(new Set()); // Menu_Id đang chờ CP_SysGetMenu
  const urlReady = useRef(false);   // đã đọc xong URL lúc vào trang chưa (trước đó không ghi đè URL)
  const urlPlain = useRef(null);    // nội dung (chưa mã hoá) đang nằm trên URL
  const urlSeq = useRef(0);         // chống ghi URL lộn thứ tự (mã hoá là bất đồng bộ)
  const [urlTick, setUrlTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const plain = await decodeWindowsParam(location.search);
      if (!alive) return;
      if (plain) {
        const restored = readWindowsUrl(plain, nodeMap);
        // trong lúc giải mã người dùng đã kịp mở chức năng khác -> giữ của người dùng
        setWindows((cur) => (cur.length ? cur : restored.windows));
        setActiveKey((cur) => (cur !== HOME ? cur : restored.active));
      }
      urlReady.current = true;
      setUrlTick((n) => n + 1);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!urlReady.current) return;
    const plain = windowsQuery(windows, activeKey).replace(/^\?/, "");
    if (plain === urlPlain.current) return;
    urlPlain.current = plain;
    const seq = ++urlSeq.current;
    (async () => {
      const search = plain ? `?s=${await encryptParam(plain)}` : "";
      if (seq !== urlSeq.current) return; // đã có thay đổi mới hơn
      navigate({ pathname: location.pathname, search }, { replace: true, state: null });
    })().catch(() => { /* không mã hoá được (trình duyệt chặn IndexedDB): bỏ qua, chỉ là không nhớ cửa sổ khi F5 */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windows, activeKey, urlTick]);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStore.get(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  // Màn hẹp (mobile): menu trái thành ngăn kéo trượt ra từ trái (☰ mở / chọn chức năng hoặc chạm nền mờ -> đóng)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.(MOBILE_MQ).matches ?? false);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_MQ);
    if (!mq) return undefined;
    const onChange = () => { setIsMobile(mq.matches); setDrawer(false); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setDrawer(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [userOpen, setUserOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);         // popup đổi mật khẩu
  const [avatarOpen, setAvatarOpen] = useState(false); // popup ảnh đại diện
  // Popup đã mở ít nhất 1 lần -> giữ lại (chỉ đổi open), để khi đóng CyberPopup còn chạy hiệu ứng thu lại
  // (gỡ component ngay khi đóng thì popup biến mất đột ngột). Chưa mở lần nào -> chưa nạp code popup.
  const [seen, setSeen] = useState({});
  useEffect(() => {
    setSeen((s) => ({ ...s, ...(pwOpen && { pw: true }), ...(avatarOpen && { avatar: true }), ...(deployOpen && { deploy: true }) }));
  }, [pwOpen, avatarOpen, deployOpen]);
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
    document.title = BRAND.webName;
  }, []);
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
    // Thôi nhận thông báo đẩy trên thiết bị này (người sau dùng máy không nhận tin của tài khoản cũ) – lúc này hub còn kết nối
    clearPushOnLogout();
    // Hiệu ứng đăng xuất: màn chính thu lại, lớp màu phủ kín rồi mới về login (login chạy tiếp hiệu ứng mở ra)
    setBye(true);
    setTimeout(() => {
      markLogoutFx();
      clearAllDrafts(); // đăng xuất chủ động: không giữ dữ liệu nhập dở của tài khoản này trên tab
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
      const show = () => {
        setWindows((ws) =>
          ws.some((w) => w.key === node.id)
            ? ws
            : [...ws, { key: node.id, node }],
        );
        setActiveKey(node.id);
      };
      // Đã mở / màn khai báo cứng -> mở luôn, không hỏi quyền
      if (windowsRef.current.some((w) => w.key === node.id) || STATIC_SCREENS[node.id]) return show();
      // Hỏi CP_SysGetMenu trước: Status = N -> không mở, báo Note bằng CyberMsgBox
      if (openingRef.current.has(node.id)) return; // đang hỏi (bấm đúp) -> bỏ qua
      openingRef.current.add(node.id);
      document.body.classList.add("is-busy");
      getMenuInfo(node.id, authUserRef.current)
        .then((info) => {
          if (isMenuAllowed(info)) return show();
          forgetMenuInfo(node.id, authUserRef.current); // lần sau hỏi lại (quyền có thể đã được cấp)
          msgbox.warning(
            String(info?.Note || "").trim() ||
              (lang === "E"
                ? "You are not allowed to use this function."
                : "Bạn không có quyền sử dụng chức năng này."),
            { title: node.text },
          );
        })
        .catch((err) => toast.error(err?.message || String(err)))
        .finally(() => {
          openingRef.current.delete(node.id);
          if (!openingRef.current.size) document.body.classList.remove("is-busy");
        });
    },
    [doLogout, toggleLang, lang],
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

  // Màn hình tự đóng cửa sổ của chính nó (vd menu chuột phải "Quay ra"):
  //   window.dispatchEvent(new CustomEvent('cyber:close-window', { detail: useScreen().id }))
  useEffect(() => {
    const onClose = (e) => { if (e.detail && e.detail !== HOME) closeWindows([e.detail]); };
    window.addEventListener("cyber:close-window", onClose);
    return () => window.removeEventListener("cyber:close-window", onClose);
  }, [closeWindows]);

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
          disabled: w.key === HOME, // Trang chủ không đóng được
          onClick: () => closeWindows([w.key]),
        },
        {
          text: "Đóng các cửa sổ khác",
          disabled: !others.length,
          onClick: () => closeWindows(others),
        },
        {
          text: "Đóng tất cả",
          disabled: !windows.length,
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

  // Logo góc trên trái: logo đơn vị (BRAND.headerLogo) – link ảnh lỗi thì quay về logo mặc định
  const DEFAULT_LOGO = "/icons/favicon.svg";
  const logoSrc = BRAND.headerLogo || DEFAULT_LOGO;
  const onLogoError = (e) => {
    if (!e.currentTarget.src.endsWith(DEFAULT_LOGO)) e.currentTarget.src = DEFAULT_LOGO;
  };

  // Có bản giao diện mới trên server (vừa "Cập nhật hệ thống") -> nhắc tải lại (kiểm tra 5 phút / lần và khi quay lại tab)
  const utRef = useRef(UT);
  utRef.current = UT;
  useEffect(
    () =>
      watchNewVersion(() =>
        toast.info(utRef.current.newVersion, {
          duration: 0,
          action: { text: utRef.current.newVersionAct, onClick: () => window.location.reload() },
        }),
      ),
    [],
  );

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
        className={`mn ${collapsed && !isMobile ? "mn--collapsed" : ""} ${drawer ? "mn--drawer" : ""} ${intro ? "mn--intro" : ""} ${resizing ? "mn--resizing" : ""} ${bye ? "mn--bye" : ""}`}
        style={{ "--side-w-open": `${sideW}px` }}
      >
        {/* ---------- Thanh trên ---------- */}
        <header className="mn__top">
          <button
            type="button"
            className="mn__burger"
            title={isMobile ? (drawer ? "Đóng menu" : "Mở menu") : collapsed ? "Mở menu" : "Thu gọn menu"}
            aria-expanded={isMobile ? drawer : undefined}
            onClick={() => (isMobile ? setDrawer((d) => !d) : setCollapsed((c) => !c))}
          >
            <Icon name="menu" size={20} />
          </button>
          {/* Logo đơn vị – bấm về Trang chủ. Đổi ảnh: BRAND.headerLogo (src/config/brand.js) */}
          <button
            type="button"
            className="mn__logo"
            title={UT.goHome}
            aria-label={UT.goHome}
            onClick={() => {
              setActiveKey(HOME);
              if (isMobile) setDrawer(false);
            }}
          >
            <img className="mn__logo-img" src={logoSrc} alt={user?.Ten_Dvcs || BRAND.unitName} onError={onLogoError} />
          </button>
          <div className="mn__menu">
            <MenuStrip tree={topTree} onOpen={openMenu} variant="header" />
          </div>
          {/* Đổi nhanh sáng / tối (chọn "Theo máy" trong menu tài khoản) */}
          <button
            type="button"
            className={`mn__theme ${theme === "dark" ? "is-dark" : ""}`}
            title={theme === "dark" ? UT.toLight : UT.toDark}
            aria-label={theme === "dark" ? UT.toLight : UT.toDark}
            onClick={toggleTheme}
          >
            <Icon name="sun" size={19} className="mn__theme-sun" />
            <Icon name="moon" size={18} className="mn__theme-moon" />
          </button>
          <div className="mn__user" ref={userRef}>
            <button
              type="button"
              className="mn__user-btn"
              onClick={() => setUserOpen((v) => !v)}
              aria-expanded={userOpen}
            >
              <span className="mn__avatar">
                <AvatarImage url={user?.Url_Avatar} initial={initial} />
                <UserMenuBadge items={moduleUserMenu} />
              </span>
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
                  {/* Ảnh đại diện: bấm vào avatar / nút máy ảnh cạnh avatar -> đổi ảnh (không để trong danh sách menu) */}
                  <button type="button" className="mn__avatar mn__avatar--lg mn__avatar--btn" title={UT.avatar} aria-label={UT.avatar}
                    onClick={() => { setUserOpen(false); setAvatarOpen(true); }}>
                    <AvatarImage url={user?.Url_Avatar} initial={initial} />
                    <span className="mn__avatar-edit" aria-hidden="true">{UT.avatarEdit}</span>
                    <span className="mn__avatar-cam" aria-hidden="true"><Icon name="camera" size={12} strokeWidth={2} /></span>
                    <i className="mn__online" />
                  </button>
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
                  {/* Phiên bản giao diện web đang chạy (tự tăng 1.0.n mỗi lần deploy) – rê chuột: commit + thời điểm build */}
                  <div className="mn__user-row mn__user-ver"
                    title={APP_BUILD.id === "dev" ? undefined : [APP_BUILD.commit, APP_BUILD.builtAt && new Date(APP_BUILD.builtAt).toLocaleString(lang === "E" ? "en-GB" : "vi-VN")].filter(Boolean).join(" · ")}>
                    <Icon name="info" size={14} />{" "}
                    <span>
                      {UT.appVer}: <b>{APP_BUILD.id === "dev" || !APP_BUILD.version ? UT.devBuild : `v${APP_BUILD.version}`}</b>
                    </span>
                  </div>
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

                <div className="mn__user-sec">
                  <div className="mn__user-label">
                    <Icon name={theme === "dark" ? "moon" : "sun"} size={14} /> {UT.theme}
                  </div>
                  <div
                    className="mn__seg mn__seg--3"
                    style={{ "--seg-i": THEMES.indexOf(themePref) }}
                    role="radiogroup"
                    aria-label={UT.theme}
                  >
                    {THEMES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={themePref === t}
                        className={themePref === t ? "is-on" : ""}
                        title={UT.themes[t]}
                        onClick={() => setThemePref(t)}
                      >
                        <Icon name={t === "light" ? "sun" : t === "dark" ? "moon" : "monitor"} size={14} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mn__user-list">
                  {/* Mục của các module (vd "Tin nhắn" – số tin chưa đọc) */}
                  {moduleUserMenu.map((it) => (
                    <button key={it.key} type="button" role="menuitem" className="mn__user-act"
                      onClick={() => { setUserOpen(false); it.onClick?.(); }}>
                      <Icon name={it.icon} size={16} /> <span>{it.text?.[lang] || it.text?.V || it.text}</span>
                      {it.useBadge && <UserMenuBadge items={[it]} inline />}
                    </button>
                  ))}
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
                  <button type="button" role="menuitem" className="mn__user-act"
                    onClick={() => { setUserOpen(false); setPwOpen(true); }}>
                    <Icon name="lock" size={16} /> <span>{UT.changePw}</span>
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
                  {/* Cập nhật phiên bản web / API trực tiếp lên server – chỉ quản trị viên */}
                  {user?.is_Admin && (
                    <button
                      type="button"
                      role="menuitem"
                      className="mn__user-act"
                      onClick={() => {
                        setUserOpen(false);
                        setDeployOpen(true);
                      }}
                    >
                      <Icon name="upload" size={16} /> <span>{UT.deploy}</span>
                    </button>
                  )}
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
            collapsed={collapsed && !isMobile}
            onExpand={() => setCollapsed(false)}
            onOpen={(node) => {
              openMenu(node);
              if (isMobile && !node?.children?.length) setDrawer(false); // chọn chức năng -> đóng ngăn kéo
            }}
          />
          <UnitSwitcher collapsed={collapsed && !isMobile} />
        </aside>
        {isMobile && drawer && (
          <div className="mn__backdrop" aria-hidden="true" onClick={() => setDrawer(false)} />
        )}
        {!collapsed && !isMobile && (
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
                <ScreenContext.Provider value={HOME_SCREEN}>
                  <Suspense
                    fallback={<div className="mn__loading">Đang tải...</div>}
                  >
                    <HomePage />
                  </Suspense>
                </ScreenContext.Provider>
              </PaneBoundary>
            </div>
            {windows.map((w) => {
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
                      <ScreenContext.Provider value={screenCtx(w.key)}>
                        <MenuScreen menu={nodeMap.get(w.key) || w.node} />
                      </ScreenContext.Provider>
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

        {(pwOpen || seen.pw) && (
          <Suspense fallback={null}>
            <ChangePasswordPopup open={pwOpen} onClose={() => setPwOpen(false)} />
          </Suspense>
        )}
        {(avatarOpen || seen.avatar) && (
          <Suspense fallback={null}>
            <AvatarPopup open={avatarOpen} onClose={() => setAvatarOpen(false)} initial={initial} />
          </Suspense>
        )}

        {(deployOpen || seen.deploy) && (
          <Suspense fallback={null}>
            <DeployPanel open={deployOpen} onClose={() => setDeployOpen(false)} user={user} />
          </Suspense>
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

// ----- URL <-> cửa sổ đang mở -----
const HOME_SCREEN = { id: HOME };
/**
 * Số trên mục menu avatar (inline) / chấm đỏ trên ảnh avatar (tổng các mục).
 * items là danh sách CỐ ĐỊNH (khai báo trong module) -> gọi hook theo vòng lặp vẫn đúng thứ tự.
 */
function UserMenuBadge({ items, inline = false }) {
  let n = 0;
  for (const it of items) if (it.useBadge) n += Number(it.useBadge()) || 0;
  if (!n) return null;
  return <i className={inline ? "mn__act-badge" : "mn__avatar-badge"}>{n > 99 ? "99+" : n}</i>;
}

const screenCtxCache = new Map();
/** Giá trị ScreenContext ổn định theo Menu_Id (không tạo object mới mỗi lần render) */
function screenCtx(id) {
  if (!screenCtxCache.has(id)) screenCtxCache.set(id, { id });
  return screenCtxCache.get(id);
}

/** "?w=A,B&f=B" -> { windows: [{ key, node }], active } – bỏ Menu_Id không còn trong menu (mất quyền / đổi menu) */
function readWindowsUrl(search, nodeMap) {
  const p = new URLSearchParams(search);
  const ids = [...new Set((p.get("w") || "").split(",").map((s) => s.trim()).filter(Boolean))];
  const windows = ids
    .filter((id) => nodeMap.has(id))
    .map((id) => ({ key: id, node: nodeMap.get(id) }));
  const f = p.get("f");
  return { windows, active: windows.some((w) => w.key === f) ? f : HOME };
}

/** Mã hoá chuỗi để đặt lên URL: AES-GCM (tokenVault) -> base64url (không có + / =) */
async function encryptParam(plain) {
  const b64 = await encryptText(plain);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** URL lúc vào trang -> nội dung gốc "w=..&f=.." (giải mã ?s=...; hỗ trợ cả URL cũ dạng ?w=...). Lỗi -> "" */
async function decodeWindowsParam(search) {
  const p = new URLSearchParams(search);
  const s = p.get("s");
  if (s) {
    try {
      let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      return await decryptText(b64);
    } catch {
      return ""; // mã hoá ở trình duyệt khác / bị sửa -> về trang chủ
    }
  }
  return p.get("w") ? search.replace(/^\?/, "") : "";
}

/** Cửa sổ đang mở -> "?w=A,B&f=B" (không mở gì -> "") */
function windowsQuery(windows, active) {
  if (!windows.length) return "";
  const ids = windows.map((w) => encodeURIComponent(w.key)).join(",");
  return `?w=${ids}${active && active !== HOME ? `&f=${encodeURIComponent(active)}` : ""}`;
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
