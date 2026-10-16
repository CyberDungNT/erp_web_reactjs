import { createContext, useContext } from 'react';

/**
 * Chức năng (màn hình) đang chứa component: { id: Menu_Id } – MainLayout bọc mỗi cửa sổ chức năng bằng context này.
 * useCyberForm dùng id để tự lưu bản nháp dữ liệu đang nhập theo từng chức năng.
 * Ngoài màn chính (vd màn đăng nhập) = null -> không lưu nháp.
 */
export const ScreenContext = createContext(null);

export const useScreen = () => useContext(ScreenContext);
