/**
 * THÔNG TIN THƯƠNG HIỆU hiển thị trên màn login / main.
 * Muốn dùng logo ảnh thật: chép file vào thư mục public (vd public/logo.png) rồi đặt logoUrl: '/logo.png'.
 */
// Tên đơn vị hiển thị mặc định (khi chưa chọn đơn vị ở màn login / chưa có thông tin từ server)
const UNIT_NAME = 'CÔNG TY CỔ PHẦN CARON HOLDINGS';

export const BRAND = {
  unitName: UNIT_NAME,
  logoUrl: '',                                   // '' -> dùng logo chữ
  logoText: UNIT_NAME,
  tagline: 'SOFTWARE SOLUTION PROVIDER',
  webName: 'WebDemo',                            // tiêu đề tab trình duyệt (đổi cả index.html + public/manifest.webmanifest)
  product: 'WebDemo',                            // dòng nhỏ trên thẻ đăng nhập / hộp "Giới thiệu"
  appName: { main: 'Web', sub: 'Demo' },         // logo trên thanh màn chính
  version: '4.0.7',
  company: UNIT_NAME,
  copyright: UNIT_NAME,
  watermark: '', // chữ chìm góc dưới màn chính ('' để ẩn)
  // Khẩu hiệu bên trái màn login – theo ngôn ngữ đang chọn (V: tiếng Việt, E: tiếng Anh)
  slogan: {
    V: ['Quản trị tập trung', 'vận hành thông minh'],
    E: ['Centralized management', 'smart operations'],
  },
  sloganSub: {
    V: 'Kết nối mọi nghiệp vụ, đồng bộ dữ liệu và tối ưu hoạt động doanh nghiệp trên một nền tảng duy nhất.',
    E: 'Connect every business process, sync your data and optimize operations on a single platform.',
  },
  forgotPasswordUrl: '',                         // link "Quên mật khẩu?" ('' -> hiện thông báo liên hệ quản trị)
};

/** Các cách đăng nhập khác (chưa nối backend – bấm sẽ hiện thông báo). enabled:false để ẩn */
export const SOCIAL_LOGINS = [
  { key: 'google', text: 'Google', enabled: true },
  { key: 'microsoft', text: 'Microsoft', enabled: true },
  { key: 'qr', text: 'QR', enabled: false },
  { key: 'otp', text: 'OTP', enabled: false },
];
