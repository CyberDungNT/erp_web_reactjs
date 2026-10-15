/**
 * Dữ liệu giả cho CP_SysLogin (rút gọn từ kết quả thật).
 * Mật khẩu "123" -> thành công, mật khẩu khác -> "Mật khẩu không đúng".
 */
import { UNITS } from './mockUnits';

const t = (phanHe, module, id, parent, bar, bar2, icon = '', extra = {}) => ({
  Stt_Phan_he: phanHe, Stt_Module: module, Menu_Id: id, Menu_Id0: parent, Bar: bar, Bar2: bar2,
  Icon: icon, ForeColor_Icon: icon ? 'gray' : '', ForeColor: '#303a3d',
  IsMaxForm: parent && !id.includes('-') ? 1 : 0, isShowTab: 0, Tag: '', url: '', ...extra,
});

const l = (id, parent, bar, bar2, icon = '', extra = {}) => ({
  Menu_Id: id, Menu_Id0: parent, Bar: bar, bar2, Icon: icon, ForeColor_Icon: parent ? '' : 'gray',
  ForeColor: '#303a3d', IsMaxForm: 1, isShowTab: 0, Tag: '', url: '', ...extra,
});

const menuBang0 = [ // bảng 0 -> menu bên trái
  t('01', '', 'DAS', '', 'Tổng quan', 'Dashboard', 'home'),
  t('01', '10', '02.01.05', 'DAS-DAS_10', 'Tổng quan tài chính', 'Dashboard - Finance'),
  t('01', '10', '02.01.07', 'DAS-DAS_10', 'Tổng quan Bán hàng', 'Dashboard - Sale'),
  t('01', '10', '02.01.15', 'DAS-DAS_10', 'Tổng quan Dịch vụ', 'Dashboard - Service'),
  t('01', '10', '02.01.25', 'DAS-DAS_10', 'Power BI - Bán xe', 'Power BI - Sale'),
  t('01', '10', 'DAS-DAS_10', 'DAS', 'Tổng quan đơn vị', 'Dashboard - Unit'),
  t('01', '15', '02.01.43', 'DAS-DAS_15', 'Tổng quan tài chính', 'Dashboard - Finance'),
  t('01', '15', '02.01.45', 'DAS-DAS_15', 'Tổng quan Bán hàng', 'Dashboard - Sale'),
  t('01', '15', 'DAS-DAS_15', 'DAS', 'Tổng quan group', 'Dashboard Group'),
  t('03', '', 'GL', '', 'Kế toán', 'Accounting', 'bank'),
  t('03', '01', '02.02.01', 'GL-GL', 'Phiếu kế toán', 'General Ledger entries'),
  t('03', '01', '02.02.07', 'GL-GL', 'Bút toán kết chuyển', 'Closing entries'),
  t('03', '01', '02.02.30', 'GL-GL', 'Đóng sổ cuối kỳ', 'Closing of the period', '', { isShowTab: 1 }),
  t('03', '01', 'GL-GL', 'GL', 'Kế toán tổng hợp', 'General Ledger'),
  t('03', '05', '02.03.01', 'GL-CA', 'Phiếu thu tiền mặt', 'Cash on hand receipt'),
  t('03', '05', '02.03.03', 'GL-CA', 'Phiếu chi tiền mặt', 'Cash on hand disbursement'),
  t('03', '05', '02.03.07', 'GL-CA', 'Giấy báo có ngân hàng', 'Bank receipt transactions'),
  t('03', '05', 'GL-CA', 'GL', 'Kế toán tiền mặt', 'Cash Management'),
  t('03', '09', '02.07.03', 'GL-SO', 'Hoá đơn bán hàng', 'Sales invoice'),
  t('03', '09', '02.07.05', 'GL-SO', 'Hoá đơn dịch vụ', 'Service invoice'),
  t('03', '09', 'GL-SO', 'GL', 'Kế toán Bán hàng', 'Sales Accounting'),
  t('05', '', '02.29.24', 'BH', 'Đơn đặt hàng', 'Orders'),
  t('05', '', '02.29.27', 'BH', 'Lệnh xuất hàng', 'Orders shipping'),
  t('05', '', '02.29.42', 'BH', 'Đăng ký giá bán', 'Register price sale'),
  t('05', '', 'BH', '', 'Bán hàng', 'Sales', 'BH'),
  t('20', '', 'BE', '', 'Bán Xe', 'Sales car', 'BE'),
  t('20', '10', '02.50.16', 'BE-BE_TN', 'Khách hàng tiềm năng', 'Potential Customers'),
  t('20', '10', '02.50.18', 'BE-BE_TN', 'Hợp đồng bán xe', 'Wehicle sales contract'),
  t('20', '10', '02.50.24', 'BE-BE_TN', 'Hóa đơn bán xe', 'Car sale invoice'),
  t('20', '10', 'BE-BE_TN', 'BE', 'Quản lý bán xe', 'Sales Management'),
  t('20', '40', '02.50.80', 'BE-BE_TON', 'Quản lý nhập kho xe', 'Vehicle Inventory Management', '', { isShowTab: 1 }),
  t('20', '40', '02.50.81', 'BE-BE_TON', 'Quản lý xuất kho xe', 'Vehicle dispatch management', '', { isShowTab: 1 }),
  t('20', '40', 'BE-BE_TON', 'BE', 'Quản lý kho xe', 'Vehicle inventory management'),
  t('22', '', 'RO', '', 'Quản lý dịch vụ', 'Service', 'RO'),
  t('22', '05', '02.55.03', 'RO-RO_05', 'Lịch hẹn sửa chữa', 'Repair appointment'),
  t('22', '05', '02.55.07', 'RO-RO_05', 'Quản lý vào/ra', 'CheckIn/CheckOut'),
  t('22', '05', 'RO-RO_05', 'RO', 'Quản lý tiếp đón', 'Reception Management'),
  t('22', '10', '02.55.32', 'RO-RO_10', 'Lệnh sửa chữa', 'Repair order', '', { isShowTab: 1 }),
  t('22', '10', '02.55.34', 'RO-RO_10', 'Lệnh phụ tùng', 'Spare parts order'),
  t('22', '10', 'RO-RO_10', 'RO', 'Quản lý sửa chữa', 'Repair Management'),
  t('07', '', 'DO', '', 'Mua hàng', 'Purchasing', 'DO'),
  t('07', '30', '02.35.10', 'DO', 'Đề nghị nhập hàng', 'Offer import goods'),
  t('07', '30', '02.35.13', 'DO', 'Đơn hàng mua hàng', 'Purchase order'),
  t('07', '30', '02.35.30', 'DO', 'Nhập kho theo đơn hàng', 'Purchase transactions For Orders'),
  t('10', '', 'IN', '', 'Quản lý kho', 'Inventory', 'IN'),
  t('10', '10', '02.39.09', 'IN', 'Yêu cầu cấp phát vật tư', 'Request for material allocation'),
  t('10', '10', '02.39.13', 'IN', 'Tra cứu tồn kho', 'Look up inventory'),
  t('10', '10', '02.11.03', 'IN', 'Phiếu nhập kho', 'Receipt transactions'),
  t('15', '', 'SX', '', 'Sản xuất', 'Production management', 'database'),
  t('15', '', '02.43.10', 'SX', 'Định mức sản xuất', 'Production norms'),
  t('15', '', '02.43.20', 'SX', 'Lệnh sản xuất', 'Production order'),
  t('27', '', 'CR', '', 'Quan hệ khách hàng', 'Customer Relationship Management', 'CR'),
  t('27', '09', '02.88.01', 'CR', 'Đánh giá khách hàng sau bán xe', 'Evaluate customer after sales'),
  t('27', '09', '02.88.16', 'CR', 'Nhắc bảo dưỡng xe (Dịch vụ)', 'Car maintenance reminder (Service)'),
  t('50', '', 'XM1', '', 'Bán xe máy', 'Sales Motor', 'XM1'),
  t('50', '05', '02.82.03', 'XM1', 'Phiếu tư vấn', 'Phiếu tư vấn'),
  t('50', '05', '02.82.05', 'XM1', 'Hợp đồng bán xe', 'Hợp đồng bán xe'),
  t('55', '', 'XM2', '', 'Dịch vụ xe máy', 'Services Motor', 'XM2'),
  t('55', '01', '02.85.03', 'XM2', 'Phiếu tiếp nhận dịch vụ', 'Phiếu tiếp nhận dịch vụ'),
  t('55', '01', '02.85.05', 'XM2', 'Lệnh sửa chữa', 'Lệnh sửa chữa'),
  t('90', '', 'KH', '', 'Kế hoạch', 'Planning', 'KH'),
  t('90', '01', '02.92.10', 'KH', 'Lập kế hoạch bán xe', 'Production Planing'),
  t('90', '01', '02.92.24', 'KH', 'Lập kế hoạch bán hàng', 'Sales Plan'),
  t('03', '17', '02.11.05', 'GL-GL', 'Phiếu xuất kho', 'Issue transactions'),
  t('03', '01', '02.02.09', 'GL-GL', 'Bút toán phân bổ', 'Allocation entry'),
  t('22', '05', '02.55.19', 'RO-RO_05', 'Thông tin lịch hẹn', 'Appointment information'),
  t('94', '', 'LOA', '', 'Phê duyệt', 'Limit of Authority', 'LOA'),
  t('94', '01', '02.94.05', 'LOA', 'Phê duyệt', 'Approve'),
  t('94', '01', '02.94.10', 'LOA', 'Đề xuất phê duyệt', 'Proposal for approval'),
];

const menuBang1 = [ // bảng 1 -> menu trên cùng
  l('01.00.00', '', 'Hệ thống', 'System', 'home'),
  l('01.01.00', '01.00.00', 'Tham số tuỳ chọn', 'Option'),
  l('01.01.01', '01.01.00', 'Khai báo danh sách chứng từ', 'Voucher list'),
  l('01.01.02', '01.01.00', 'Khai báo chi tiết chứng từ', 'Declare interm of voucher'),
  l('01.01.04', '01.01.00', '---', '---'),
  l('01.01.05', '01.01.00', 'Khai báo đơn vị hạch toán', 'Voucher list'),
  l('01.04.00', '01.00.00', 'Cấp và phân quyền', 'Issuance and authorization'),
  l('01.04.05', '01.04.00', 'Tạo và phân quyền sử dụng', 'Declare group and premissions', 'user'),
  l('01.04.08', '01.04.00', 'Đổi mật khẩu', 'Change password'),
  l('01.06.00', '01.00.00', '---', '---'),
  l('01.12.00', '01.00.00', 'English interface', 'Giao diện tiếng việt'),
  l('01.19.00', '01.00.00', 'Kết thúc', 'Exit', 'EXIT'),
  l('02.00.00', '', 'Giao dịch', 'Transaction', 'exchange'),
  l('02.02.00', '02.00.00', 'Kế toán tổng hợp', 'Transaction - General'),
  l('02.02.01', '02.02.00', 'Phiếu kế toán', 'General Ledger entries'),
  l('02.02.05', '02.02.00', '---', '---'),
  l('02.02.07', '02.02.00', 'Bút toán kết chuyển', 'Closing entries'),
  l('02.03.00', '02.00.00', 'Kế toán vốn bằng tiền', 'Transaction - Cash'),
  l('02.03.01', '02.03.00', 'Phiếu thu tiền mặt', 'Cash on hand receipt'),
  l('02.03.03', '02.03.00', 'Phiếu chi tiền mặt', 'Cash on hand disbursement'),
  l('03.00.00', '', '&Báo cáo', '&Reports', 'report'),
  l('03.02.00', '03.00.00', 'Báo cáo kế toán', 'Cash report'),
  l('03.02.01', '03.02.00', 'Sổ quỹ', 'Cash book'),
  l('03.02.05', '03.02.00', 'Sổ chi tiết tài khoản', 'Account activity'),
  l('03.12.00', '03.00.00', 'Báo cáo kế toán - Nhật ký chứng từ', 'Accounting report - Journal voucher'),
  l('03.12.03', '03.12.00', 'Nhật ký chứng từ 1-10', 'Journal vouchers 1-10'),
  l('03.12.05', '03.12.03', 'Nhật ký chứng từ số 1 - Tiền mặt', 'Journal voucher No 1'),
  l('03.12.07', '03.12.03', 'Nhật ký chứng từ số 2 - Tiền gửi', 'Journal voucher No 2'),
  l('05.00.00', '', '&Danh mục', '&Lists', 'list'),
  l('05.01.00', '05.00.00', 'Danh mục kế toán', 'List of Accounts'),
  l('05.01.01', '05.01.00', 'Danh mục tài khoản', 'Chart of accounts'),
  l('05.09.00', '05.00.00', 'Danh mục quản lý kho', 'Inventory lists'),
  l('05.09.01', '05.09.00', 'Danh mục vật tư hàng hoá', 'Item list'),
  l('05.09.07', '05.09.00', 'Danh mục kho hàng', 'Warehouse list'),
  l('07.00.00', '', '&Số dư', 'Balance', 'wallet'),
  l('07.03.00', '07.00.00', 'Số dư đầu kỳ tài khoản', 'Opening balances Accounting'),
  l('07.03.03', '07.03.00', 'Số dư đầu kỳ các tài khoản', 'Account opening balances'),
  l('09.00.00', '', '&Tính toán', '&Calculation', 'calculator'),
  l('09.01.00', '09.00.00', 'Tính giá vốn cho hàng hoá vật tư', 'Calculate average cost'),
  l('09.38.00', '09.00.00', 'Tính khấu hao tháng', 'Calculate month depreciation'),
];

const dashboards = [
  { PageName: 'FrmReference', CP_name: 'CP_SysGetReference', Para: '', isRefresh: 0, Title: 'HOME' },
  { PageName: 'Dashboard_View2', CP_name: 'CP_DashboardRO_DsLichHen', Para: '', isRefresh: 1, Title: 'LỊCH HẸN' },
  { PageName: 'Dashboard_View2', CP_name: 'CP_DashboardBE_DsGiaoXe', Para: '', isRefresh: 0, Title: 'GIAO XE' },
  { PageName: 'Dashboard_Sale01', CP_name: 'CP_ToanLC', Para: '1#ABC', isRefresh: 1, Title: 'BÁN XE' },
  { PageName: 'Dashboard_DMS_Service', CP_name: 'CP_DashboardRO_Service', Para: '', isRefresh: 1, Title: 'DỊCH VỤ' },
  { PageName: 'Dashboard_DMS_Sales', CP_name: 'CP_DashboardBE_Sales', Para: '', isRefresh: 1, Title: 'BÁN XE' },
];

const baseInfo = {
  Ma_Dvcs: '01', Ten_Dvcs: 'CÔNG TY CỔ PHẦN CARON HOLDINGS', Ma_TTCP: '01', Ten_TTCP: 'Văn phòng CARON HOLDINGS',
  User_Id: 1, TamTrang: 0, Url_Avatar: '', Ten_Cty: 'Văn phòng CARON HOLDINGS', M_Lan: 'V', FrmHome: 'FrmHome',
  Title: 'CÔNG TY CỔ PHẦN CARON HOLDINGS  -  VĂN PHÒNG CARON HOLDINGS', Ngay_Ks: '01/01/2025',
  Version: 'Cyber Plus 10.1', isUpdateMenu: 1, Mfa_Method: '', Mfa_Enrolled: 0, IsChat: '1', ShowDashBoardHome: '1',
};

export function mockLogin([, , userName = '', password = '', , , , maTTCP = '01']) {
  const unit = UNITS.find((u) => u.Ma_TTCP === maTTCP);
  if (!unit) {
    return { Table: dashboards, Table1: [{ ...baseInfo, status: 'N', Msg: 'Y', Note: `Không có quyền truy cập đơn vị ${maTTCP}`, TokenKey: '', User_name: userName }] };
  }
  const unitInfo = { Ma_Dvcs: unit.Ma_Dvcs, Ma_TTCP: unit.Ma_TTCP, Ten_TTCP: unit.Ten_TTCP, Ten_Cty: unit.Ten_TTCP,
    Ngay_Ks: unit.Ngay_KS.slice(8, 10) + '/' + unit.Ngay_KS.slice(5, 7) + '/' + unit.Ngay_KS.slice(0, 4),
    Title: `${baseInfo.Ten_Dvcs}  -  ${unit.Ten_TTCP.toUpperCase()}` };
  if (password === '123') {
    return {
      Table: menuBang0,
      Table1: menuBang1,
      Table2: dashboards,
      Table3: [{
        ...baseInfo, ...unitInfo, status: 'Y', Msg: 'N', Note: 'Truy cập thành công', is_Admin: 1, Is_Login_Otp: 0, ChangPass: 0,
        TokenKey: '21138272-B3C6-43E3-8A08-A6F18B424893', User_name: userName,
        Comment: 'Nguyễn Tiến Dũng', EMail: 'admin@congty.vn', Telephone: '',
      }],
    };
  }
  return {
    Table: dashboards,
    Table1: [{
      ...baseInfo, status: 'N', Msg: 'Y', Note: 'Mật khẩu không đúng', is_Admin: null, Is_Login_Otp: null,
      ChangPass: null, TokenKey: '', User_name: userName, Comment: '', EMail: null, Telephone: null,
    }],
  };
}

export function mockDashboard() {
  return {
    Table: [
      { Gio_Hen: '08:30', Bien_So: '30A-123.45', Khach_Hang: 'Nguyễn Văn An', Dich_Vu: 'Bảo dưỡng 10.000 km', Trang_Thai: 'Đã xác nhận' },
      { Gio_Hen: '09:15', Bien_So: '29H-678.90', Khach_Hang: 'Trần Thị Bình', Dich_Vu: 'Sửa phanh', Trang_Thai: 'Chờ' },
      { Gio_Hen: '10:00', Bien_So: '51G-246.80', Khach_Hang: 'Lê Hoàng Cường', Dich_Vu: 'Thay dầu', Trang_Thai: 'Đã đến' },
    ],
  };
}
