/**
 * THÔNG TIN THƯƠNG HIỆU hiển thị trên màn login / main.
 * Muốn dùng logo ảnh thật: chép file vào thư mục public (vd public/logo.png) rồi đặt logoUrl: '/logo.png'.
 */
export const BRAND = {
  logoUrl: '',                                   // '' -> dùng logo chữ
  logoText: 'CYBERSOFT',
  tagline: 'SOFTWARE SOLUTION PROVIDER',
  product: 'CYBER PLUS 10',                      // dòng nhỏ trên thẻ đăng nhập
  appName: { main: 'CYBER', sub: 'Plus 10.1' },  // logo trên thanh màn chính
  version: '4.0.7',
  company: 'CYBERSOFT SOFTWARE SOLUTIONS COMPANY LIMITED',
  copyright: 'CYBERSOFT',
  watermark: 'WWW.CYBERSOFT.COM.VN - Hotline: 1900.54.54.34', // chữ chìm góc dưới màn chính ('' để ẩn)
  slogan: ['Quản trị tập trung', 'vận hành thông minh'],
  sloganSub: 'Kết nối mọi nghiệp vụ, đồng bộ dữ liệu và tối ưu hoạt động doanh nghiệp trên một nền tảng duy nhất.',
  forgotPasswordUrl: '',                         // link "Quên mật khẩu?" ('' -> hiện thông báo liên hệ quản trị)
};

/** Các cách đăng nhập khác (chưa nối backend – bấm sẽ hiện thông báo). enabled:false để ẩn */
export const SOCIAL_LOGINS = [
  { key: 'google', text: 'Google', enabled: true },
  { key: 'microsoft', text: 'Microsoft', enabled: true },
  { key: 'qr', text: 'QR', enabled: true },
  { key: 'otp', text: 'OTP', enabled: true },
];
