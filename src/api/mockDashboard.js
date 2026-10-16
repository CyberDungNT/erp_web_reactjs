/**
 * DỮ LIỆU GIẢ cho dashboard trang chủ (HomeDashboard) – dùng khi chưa có proc thật.
 * Trả về Data giống ds.ToJsonObject(): { Table: KPI, Table1: theo tháng, Table2: chi nhánh, Table3: nhóm hàng, Table4: top hàng }
 */
export const mockDashboardHome = ([soThang = '12']) => {
  const n = Math.max(1, Math.min(12, Number(soThang) || 12));
  const now = new Date();
  const wave = (i, base, amp, seed) => Math.round(base + amp * Math.sin((i + seed) / 1.9) + ((i * 7919 + seed * 104729) % 97) * base * 0.002);
  const months = Array.from({ length: n }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - k), 1);
    const i = d.getMonth();
    return {
      Thang: `T${String(i + 1).padStart(2, '0')}/${d.getFullYear()}`,
      NamNay: wave(i + k * 0.15, 4.2e9, 1.1e9, 3) + k * 6e7,
      NamTruoc: wave(i, 3.6e9, 0.9e9, 5),
      DonHang: wave(i, 820, 160, 2) + k * 9,
      KhachMoi: wave(i, 64, 18, 4),
      TonKho: wave(i, 11.5e9, 1.4e9, 1),
    };
  });
  const last = months[n - 1];
  const prev = months[n - 2] || last;
  const total = months.reduce((s, m) => s + m.NamNay, 0);
  return {
    Table: [
      { Ma: 'DOANHTHU', Ten: 'Doanh thu tháng', GiaTri: last.NamNay, KyTruoc: prev.NamNay, Kieu: 'money', Cot: 'NamNay' },
      { Ma: 'DONHANG', Ten: 'Đơn hàng', GiaTri: last.DonHang, KyTruoc: prev.DonHang, Kieu: 'number', Cot: 'DonHang' },
      { Ma: 'KHACHMOI', Ten: 'Khách hàng mới', GiaTri: last.KhachMoi, KyTruoc: prev.KhachMoi, Kieu: 'number', Cot: 'KhachMoi' },
      { Ma: 'TONKHO', Ten: 'Giá trị tồn kho', GiaTri: last.TonKho, KyTruoc: prev.TonKho, Kieu: 'money', Cot: 'TonKho', NguocChieu: 1 },
    ],
    Table1: months,
    Table2: [
      { Ten: 'Chi nhánh Hà Nội', DoanhThu: Math.round(total * 0.34) },
      { Ten: 'Chi nhánh TP.HCM', DoanhThu: Math.round(total * 0.29) },
      { Ten: 'Chi nhánh Đà Nẵng', DoanhThu: Math.round(total * 0.16) },
      { Ten: 'Chi nhánh Cần Thơ', DoanhThu: Math.round(total * 0.12) },
      { Ten: 'Chi nhánh Hải Phòng', DoanhThu: Math.round(total * 0.09) },
    ],
    Table3: [
      { Nhom: 'Máy tính & laptop', DoanhThu: Math.round(total * 0.46) },
      { Nhom: 'Thiết bị ngoại vi', DoanhThu: Math.round(total * 0.27) },
      { Nhom: 'Linh kiện', DoanhThu: Math.round(total * 0.17) },
      { Nhom: 'Văn phòng phẩm', DoanhThu: Math.round(total * 0.10) },
    ],
    Table4: [
      { MaHang: 'HH001', TenHang: 'Laptop Dell Latitude 5440', SoLuong: 38 * n, DoanhThu: 38 * n * 21500000 },
      { MaHang: 'HH003', TenHang: 'Màn hình LG 27 inch', SoLuong: 61 * n, DoanhThu: 61 * n * 4890000 },
      { MaHang: 'HH007', TenHang: 'Ổ cứng SSD Samsung 1TB', SoLuong: 74 * n, DoanhThu: 74 * n * 2190000 },
      { MaHang: 'HH006', TenHang: 'Bàn phím cơ Akko 3087', SoLuong: 52 * n, DoanhThu: 52 * n * 1250000 },
      { MaHang: 'HH002', TenHang: 'Chuột Logitech M331', SoLuong: 140 * n, DoanhThu: 140 * n * 390000 },
    ],
  };
};
