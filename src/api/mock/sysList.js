/**
 * Giả lập CP_SysList (danh mục chung – ListScreen). Cấu trúc bảng giống thủ tục thật:
 *   Table  = dữ liệu, Table1 = cấu hình, Table2 = head (Field_Name...), Table3 = cột tìm kiếm,
 *   Table4 = thông tin đơn vị, Table5 = năm, Table6 = Status/Msg/Note
 */
const TK = [
  // [Tk0, Tk011 (thụt lề), Tên, TK mẹ, Bậc, Loại TK, TK SC, Bold, BackColor]
  ['1111', ' 1111', 'Tiền Việt Nam', '111', 2, 0],
  ['11111', '  11111', 'Tiền mặt VNĐ', '1111', 3, 1],
  ['11112', '  11112', 'Tiền mặt Coffee on', '1111', 3, 1],
  ['1112', '  1112', 'Ngoại tệ', '1111', 3, 1],
  ['1113', '  1113', 'Vàng tiền tệ', '1111', 3, 1],
  ['112', '112', 'Tiền gửi không kỳ hạn', '', 1, 0, 1, 1, '255, 224, 192'],
  ['1121', ' 1121', 'Tiền Việt Nam', '112', 2, 0],
  ['1121.1', '  1121.1', 'Tiền gửi Ngân hàng Techcombank EV', '1121', 3, 0],
  ...['Trụ sở - TechcomBank - TK 80079999', 'Hoàng Quốc Việt - Techcombank - TK 19040065903086', 'Sóc Sơn - Techcombank - TK 19040065903078',
    'Mễ Trì - Techcombank - TK 19040065903061', 'Thượng Thanh - TechcomBank - TK 19040065903051', 'Tên Lửa - Techcombank - TK 19040065903043',
    'Long Biên - Techcombank - TK 19040065903035'].map((t, i) => [`1121.1${i}`, `   1121.1${i}`, `EV ${t} - TG - VNĐ`, '1121.1', 4, 1]),
  ['1121.2', '  1121.2', 'Tiền gửi Ngân hàng BIDV EV', '1121', 3, 0],
  ['1121.20', '   1121.20', 'EV Trụ sở - BIDV Đống Đa - 8600045155 - TG - VNĐ', '1121.2', 4, 1],
  ['1121.3', '  1121.3', 'Tiền gửi ngân hàng VPbank CRH', '1121', 3, 0],
  ...['Trụ sở CRH - 93368888', 'Sóc Sơn - 992268888', 'Gia Lâm - 457252978', 'Giải Phóng - 861122686'].map((t, i) => [`1121.3${i}`, `   1121.3${i}`, `TG - VNĐ - VPB - ${t}`, '1121.3', 4, 1]),
  ['131', '131', 'Phải thu của khách hàng', '', 1, 0, 0, 1, '255, 224, 192'],
  ['1311', ' 1311', 'Phải thu khách hàng ngắn hạn', '131', 2, 1],
  ['331', '331', 'Phải trả cho người bán', '', 1, 0, 0, 1, '255, 224, 192'],
  ['3311', ' 3311', 'Phải trả người bán ngắn hạn', '331', 2, 1],
];

const data = TK.map(([tk0, tk011, ten, tkMe, bac, loai, tkSc = 0, bold = 0, back = '']) => ({
  BAC_TK: bac, LOAI_TK: loai, MA_NT: 'VND', TEN_NGAN: '', TEN_NGAN2: '', TEN_TK0: ten, TEN_TK02: '', TK_CN: 0, TK_ME: tkMe,
  TK_SC: tkSc, Tk0: tk0, ForeColor: '', Bold: bold, Tk011: tk011, BackColor: back, SearchShortText: '',
}));

const H = (Stt, Field_ban, Field_ban0, Field_Name, Field_Head, Field_Type, Field_Width, TextAlign, Carry = 1) =>
  ({ Stt, Field_ban, Field_ban0, Field_Name, Field_Head, Field_Type, Field_ReOnly: 0, Field_Width, Upper: 0, Format: '', BackColor_ban: '', BackColor_ban2: '', ForeColor_ban: '', Carry, TextAlign, SumAvgCountMinMax: 0, CaptionGroup: '' });

const head = [
  H(1, 'TK0_TEN', '', '', 'Thông tin tài khoản', 'C', 0, '', 0),
  H(2, 'Tk011', 'TK0_TEN', 'tk011', 'Tài khoản', 'C', 130, 'L'),
  H(3, 'TEN_TK0', 'TK0_TEN', 'TEN_TK0', 'Tên tài khoản', 'C', 450, 'L'),
  H(4, 'TEN_TK02', '', 'TEN_TK02', 'Tên tài khoản 2', 'C', 164, 'L'),
  H(5, 'TK_ME', '', 'TK_ME', 'TK Mẹ', 'C', 100, 'L'),
  H(6, 'MA_NT', '', 'MA_NT', 'Ngoại tệ', 'C', 88, 'L'),
  H(7, 'TK_SC', '', 'TK_SC', 'TK SC', 'B', 100, 'C'),
  H(8, 'TK_CN', '', 'TK_CN', 'TK CN', 'B', 100, 'C'),
  H(9, 'BAC_TK', '', 'BAC_TK', 'Bậc TK', 'N', 100, 'R'),
  H(10, 'LOAI_TK', '', 'LOAI_TK', 'Loại TK', 'B', 100, 'C'),
  H(11, 'TEN_NGAN', '', 'TEN_NGAN', 'Tên ngắn', 'C', 220, 'L'),
];

const search = [
  { Stt: -10, Field_Type: '', Field_Name: '', Field_Head: 'Tất cả' },
  { Stt: 1, Field_Type: 'C', Field_Name: '', Field_Head: 'Thông tin tài khoản' },
  { Stt: 2, Field_Type: 'C', Field_Name: 'tk011', Field_Head: 'Tài khoản' },
  { Stt: 3, Field_Type: 'C', Field_Name: 'TEN_TK0', Field_Head: 'Tên tài khoản' },
  { Stt: 4, Field_Type: 'C', Field_Name: 'TEN_TK02', Field_Head: 'Tên tài khoản 2' },
  { Stt: 5, Field_Type: 'C', Field_Name: 'TK_ME', Field_Head: 'TK Mẹ' },
  { Stt: 6, Field_Type: 'C', Field_Name: 'MA_NT', Field_Head: 'Ngoại tệ' },
];

export function mockSysList([, , , code = '']) {
  if (code !== 'DMTK0') {
    return { Table: [], Table1: [{ Status: 'N', Msg: 'Y', Note: `[MOCK] Chưa có dữ liệu giả cho danh mục ${code}`, M_Lan: 'V' }] };
  }
  return {
    Table: data,
    Table1: [{ Order: 'Tk0', Title: 'Danh mục tài khoản', ColFrozen: 5, RowFrozen: 1, Tree: 0, Is_nhom: 0, FormInPut: 'DMTK0', HelpName: 'DMTK0' }],
    Table2: head,
    Table3: search,
    Table4: [{ Ma_Dvcs: '01', Ten_TTCP: 'Văn phòng CARON HOLDINGS' }],
    Table5: [],
    Table6: [{ Status: 'Y', Msg: 'N', Note: 'OK', M_Lan: 'V' }],
  };
}

/** Giả lập lưu (form DMTK0 – CyberFrmListF3): [mã DM, N|E, JSON dòng, ...] -> cập nhật data giả */
export function mockSysListSave([, mode = 'N', json = '{}']) {
  const row = JSON.parse(json || '{}');
  const i = data.findIndex((r) => r.Tk0 === row.Tk0);
  if (mode === 'N' && i >= 0) return { Table: [{ Status: 'N', Msg: 'Y', Note: `Tài khoản ${row.Tk0} đã tồn tại.` }] };
  const full = { ...(i >= 0 ? data[i] : {}), ...row, Tk011: (i >= 0 ? data[i].Tk011 : row.Tk0) };
  if (i >= 0) data[i] = full; else data.push(full);
  return { Table: [{ Status: 'Y', Msg: 'N', Note: 'OK' }] };
}
