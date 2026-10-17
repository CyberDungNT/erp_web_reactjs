/**
 * Icon SVG nét mảnh (viewBox 24). Dùng: <Icon name="home" size={18} />
 * MenuIcon map tên Icon từ DB (home, bank, BH, BE, RO...) sang icon; không có thì hiện chữ cái đầu.
 */
const P = {
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  bank: 'M3 9 12 4l9 5M4 9h16M6 9v8m4-8v8m4-8v8m4-8v8M3 20h18',
  cart: 'M3 4h2l2.5 11h10L20 8H6.5M9 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01',
  car: 'M5 16V12l2-5h10l2 5v4M3 16h18v3H3zM7 19v1m10-1v1M7 13h.01M17 13h.01',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8 7.2 20l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.6',
  bike: 'M5.5 18a3.5 3.5 0 1 0 0-.01M18.5 18a3.5 3.5 0 1 0 0-.01M5.5 18 9 10h6l3.5 8M9 10 7.5 6H5m10 4 1-4h3',
  calendar: 'M4 5h16v16H4zM4 10h16M8 3v4m8-4v4',
  check: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM8.5 12l2.5 2.5 4.5-5',
  box: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  exchange: 'M4 8h13l-3-3M20 16H7l3 3',
  report: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-4v4M16 13.5h.01',
  calculator: 'M5 3h14v18H5zM8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  exit: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  folder: 'M3 6h6l2 2h10v11H3z',
  file: 'M7 3h7l4 4v14H7zM14 3v4h4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6 6 18',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
  building: 'M4 21V4h10v17M14 9h6v12M8 8h2m-2 4h2m-2 4h2M3 21h18',
  refresh: 'M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4',
  dashboard: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
  tools: 'M4 20l7-7M14 4l6 6-3 3-6-6zM5 5l4 4',
  warning: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 18.5h1.5V20H14zM18.5 14H20v1.5h-1.5zM6.5 6.5h1v1h-1zM16.5 6.5h1v1h-1zM6.5 16.5h1v1h-1z',
  phone: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2',
  chevronUpDown: 'M8 9l4-4 4 4M8 15l4 4 4-4',
  chevronLeft: 'M15 6l-6 6 6 6',
  tick: 'M5 12.5l4.5 4.5L19 7.5',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  cart2: 'M3 4h2l2.5 11h10L20 8H6.5M9 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 15.5h5M10 9h2',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  shrink: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  sidebar: 'M4 4h16v16H4zM9 4v16',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.1-2.4 3.6M12 17h.01',
};

export default function Icon({ name, size = 18, strokeWidth = 1.7, className = '', style, title }) {
  const d = P[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={`cy-icon ${className}`} style={style} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
}

// Tên icon trong DB -> icon
const MENU_ICON_MAP = {
  home: 'home', bank: 'bank', database: 'database', exchange: 'exchange', report: 'report', list: 'list',
  wallet: 'wallet', calculator: 'calculator', user: 'user', exit: 'exit', data: 'database',
  bh: 'cart', do: 'truck', be: 'car', ro: 'wrench', cr: 'users', xm1: 'bike', xm2: 'wrench',
  kh: 'calendar', loa: 'check', in: 'box', sx: 'database', das: 'dashboard',
  gl: 'bank', ca: 'wallet',
};

/** Icon trong DB có map được sang icon vẽ sẵn không */
export function hasMenuIcon(icon) {
  const key = String(icon || '').trim().toLowerCase();
  return !!(MENU_ICON_MAP[key] || P[key]);
}

export function MenuIcon({ icon, fallbackText = '', size = 18, color }) {
  const key = String(icon || '').trim().toLowerCase();
  const name = MENU_ICON_MAP[key] || (P[key] ? key : null);
  const style = color && color !== 'gray' ? { color } : undefined;
  if (name) return <Icon name={name} size={size} style={style} />;
  const letter = (fallbackText || icon || '?').trim().charAt(0).toUpperCase();
  return (
    <span className="cy-icon-letter" style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {letter}
    </span>
  );
}
