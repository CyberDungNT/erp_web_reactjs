/**
 * DỮ LIỆU GIẢ để test khi chưa có backend (VITE_USE_MOCK=true).
 * Mỗi hàm nhận mảng tham số (đã tách theo #) và trả về Data giống ds.ToJsonObject().
 */

import { mockLogin, mockDashboard } from './login';
import { mockGetUnits } from './units';
import { mockDashboardHome } from './dashboard';

const khachHang = [
  { MaKH: 'KH001', TenKH: 'Công ty TNHH Minh Phát', DiaChi: 'Q.1, TP.HCM', DienThoai: '0901234567' },
  { MaKH: 'KH002', TenKH: 'Công ty CP Hoàng Long', DiaChi: 'Cầu Giấy, Hà Nội', DienThoai: '0912345678' },
  { MaKH: 'KH003', TenKH: 'Cửa hàng Bình An', DiaChi: 'Hải Châu, Đà Nẵng', DienThoai: '0923456789' },
  { MaKH: 'KH004', TenKH: 'Siêu thị Thành Đạt', DiaChi: 'Ninh Kiều, Cần Thơ', DienThoai: '0934567890' },
  { MaKH: 'KH005', TenKH: 'Công ty TNHH Phú Quý', DiaChi: 'Lê Chân, Hải Phòng', DienThoai: '0945678901' },
  { MaKH: 'KH006', TenKH: 'Đại lý Hưng Thịnh', DiaChi: 'Biên Hoà, Đồng Nai', DienThoai: '0956789012' },
  { MaKH: 'KH007', TenKH: 'Công ty CP Ánh Dương', DiaChi: 'Thủ Đức, TP.HCM', DienThoai: '0967890123' },
];

const kho = [
  { MaKho: 'K01', TenKho: 'Kho tổng Hà Nội' },
  { MaKho: 'K02', TenKho: 'Kho chi nhánh HCM' },
  { MaKho: 'K03', TenKho: 'Kho hàng lỗi' },
];

const hangHoa = [
  { MaHang: 'HH001', TenHang: 'Laptop Dell Latitude 5440', DVT: 'Cái', SoLuong: 12, DonGia: 21500000, NgayNhap: '2026-09-01T00:00:00', ConKD: true },
  { MaHang: 'HH002', TenHang: 'Chuột Logitech M331', DVT: 'Cái', SoLuong: 150, DonGia: 390000, NgayNhap: '2026-09-05T00:00:00', ConKD: true },
  { MaHang: 'HH003', TenHang: 'Màn hình LG 27 inch', DVT: 'Cái', SoLuong: 34, DonGia: 4890000, NgayNhap: '2026-09-10T00:00:00', ConKD: true },
  { MaHang: 'HH004', TenHang: 'Giấy A4 Double A', DVT: 'Ram', SoLuong: 820, DonGia: 72500, NgayNhap: '2026-09-12T00:00:00', ConKD: true },
  { MaHang: 'HH005', TenHang: 'Máy in Canon LBP2900', DVT: 'Cái', SoLuong: 0, DonGia: 3650000, NgayNhap: '2026-08-20T00:00:00', ConKD: false },
  { MaHang: 'HH006', TenHang: 'Bàn phím cơ Akko 3087', DVT: 'Cái', SoLuong: 45, DonGia: 1250000, NgayNhap: '2026-09-18T00:00:00', ConKD: true },
  { MaHang: 'HH007', TenHang: 'Ổ cứng SSD Samsung 1TB', DVT: 'Cái', SoLuong: 60, DonGia: 2190000.5, NgayNhap: '2026-10-01T00:00:00', ConKD: true },
];

// Bảng head mô tả cột cho CyberTable (có thể lưu trong DB và trả từ proc)
const hangHoaHead = [
  { Field: 'MaHang', Caption: 'Mã hàng', Width: 90 },
  { Field: 'TenHang', Caption: 'Tên hàng', Width: 240 },
  { Field: 'DVT', Caption: 'ĐVT', Width: 60, Align: 'center' },
  { Field: 'SoLuong', Caption: 'Số lượng', Width: 90, Type: 'number', Decimals: 0, Sum: true },
  { Field: 'DonGia', Caption: 'Đơn giá', Width: 120, Type: 'number', Decimals: 2 },
  { Field: 'NgayNhap', Caption: 'Ngày nhập', Width: 100, Type: 'date' },
  { Field: 'ConKD', Caption: 'Còn KD', Width: 70, Type: 'bool' },
];

const procs = {
  CP_SysLogin: mockLogin,
  CP_SysGetUnits: mockGetUnits,
  // Mở chức năng: FormInPut = tên file màn hình trong src/modules (screens/menuForm.js)
  CP_SysGetMenu: ([menuId = '']) => {
    const MOCK_FORMS = {
      '02.02.01': 'PhieuNhapPage',     // có file -> mở màn
      '02.29.24': 'HangHoa',           // bỏ đuôi "Page" vẫn tìm ra HangHoaPage.jsx
      '02.03.01': 'PhieuThuTienMat',   // chưa có file -> trang hướng dẫn tạo file
    };
    if (menuId === '02.02.30') {
      return { Table: [{ Status: 'N', Msg: 'Y', Note: 'Bạn không có quyền sử dụng chức năng Đóng sổ cuối kỳ.' }] };
    }
    return {
      Table: [{
        Status: 'Y', Msg: 'N', Note: 'OK', Name: `CP_${menuId}`, Ma_Ct: '', IsVoucher: 0, IsList: 0, IsReport: 0, IsCaculator: 0,
        IsSystem: 0, FormInPut: MOCK_FORMS[menuId] || '', Menu_Id: menuId, IsMaxForm: 1, Chk_Pass: 0, HelpName: '', Para: '',
        IsShowTab: 0, Cp_NameCaculator: null, isShowPopupCaculator: 0, FormCaculatorNext: null,
      }],
    };
  },
  CP_ToanLC: mockDashboard,
  CP_DashboardBE_Sales: mockDashboard,
  CP_DashboardRO_DsLichHen: mockDashboard,
  CP_DashboardBE_DsGiaoXe: mockDashboard,
  CP_DashboardRO_Service: mockDashboard,
  // Lookup khách hàng: Para = "từ khoá"
  Demo_LookupKhachHang: ([keyword = '']) => {
    const k = keyword.trim().toLowerCase();
    return {
      Table: khachHang.filter(
        (r) => !k || r.MaKH.toLowerCase().includes(k) || r.TenKH.toLowerCase().includes(k)
      ),
    };
  },
  Demo_GetKho: () => ({ Table: kho }),
  // Trả 2 bảng: Table = head, Table1 = data
  Demo_GetHangHoa: () => ({ Table: hangHoaHead, Table1: hangHoa }),
  Demo_SaveHangHoa: ([maHang, tenHang, soLuong, donGia]) => {
    const row = hangHoa.find((r) => r.MaHang === maHang);
    if (row) Object.assign(row, { TenHang: tenHang, SoLuong: +soLuong, DonGia: +donGia });
    return { Table: [{ Result: 'OK' }] };
  },
  Demo_DeleteHangHoa: ([maHang]) => {
    const idx = hangHoa.findIndex((r) => r.MaHang === maHang);
    if (idx >= 0) hangHoa.splice(idx, 1);
    return { Table: [{ Result: 'OK' }] };
  },
};

// ===== Phiếu nhập kho (màn mẫu CyberForm: PhieuNhapPage) =====
let soPhieu = 12;
procs.Demo_GetSoCT = () => ({ Table: [{ SoCT: `PN-2026-${String(soPhieu + 1).padStart(4, '0')}` }] });
procs.Demo_SavePhieuNhap = ([soCT, , maKH, maKho, , chiTiet = '[]']) => {
  if (!maKH || !maKho) return { Table: [{ Result: 'ERR', Message: 'Thiếu khách hàng hoặc kho' }] };
  const lines = JSON.parse(chiTiet || '[]');
  soPhieu += 1;
  return { Table: [{ Result: 'OK', SoCT: soCT, SoDong: lines.length }] };
};


// Dashboard trang chủ (HomeDashboard): CP_DashboardHome @SoThang
procs.CP_DashboardHome = mockDashboardHome;

export async function mockExecute({ Name, Para }) {
  await new Promise((r) => setTimeout(r, 250)); // giả lập độ trễ mạng
  const fn = procs[Name];
  if (!fn) {
    return { status: false, message: `[MOCK] Không có proc '${Name}'. Đặt VITE_USE_MOCK=false để gọi server thật.`, data: null };
  }
  const params = Para ? Para.split('#') : [];
  return { status: true, message: 'thành công', data: fn(params) };
}
