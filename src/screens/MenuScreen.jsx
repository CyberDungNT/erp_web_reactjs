import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import Icon from '@/components/icons/Icon';
import { screens, Placeholder } from './registry';
import { findForm, getMenuInfo, isMenuAllowed, MENU_PROC } from './menuForm';

/**
 * Cửa sổ chức năng trong màn chính (MainLayout dùng cho mọi Menu_Id):
 *   1. Menu_Id khai báo cứng trong src/modules/<phân-hệ>/index.js (screens) -> mở luôn (màn DEV, màn đặc biệt)
 *   2. Còn lại: gọi CP_SysGetMenu -> FormInPut -> mở file cùng tên (screens/menuForm.js)
 */
export default function MenuScreen({ menu }) {
  const Static = screens[menu?.id];
  if (Static) return <Static menu={menu} />;
  return <DbScreen menu={menu} />;
}

function DbScreen({ menu }) {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    getMenuInfo(menu.id, user, { refresh: reload > 0 })
      .then((info) => alive && setState({ info }))
      .catch((err) => alive && setState({ error: err.message || String(err) }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu.id, reload]);

  if (state.loading) return <ScreenLoading text={menu.text} />;
  if (state.error) {
    return <ScreenMessage menu={menu} icon="warning" title="Không mở được chức năng" detail={state.error} onRetry={() => setReload((n) => n + 1)} />;
  }

  const { info } = state;
  if (!isMenuAllowed(info)) {
    return <ScreenMessage menu={menu} icon="lock" title="Không mở được chức năng" detail={info.Note || 'Bạn không có quyền sử dụng chức năng này.'} onRetry={() => setReload((n) => n + 1)} />;
  }
  const form = findForm(info.FormInPut);
  if (!form) return <Placeholder menu={menu} menuInfo={info} />;
  const { Component } = form;
  return <Component menu={menu} menuInfo={info} />;
}

function ScreenLoading({ text }) {
  return (
    <div className="mn-open">
      <span className="mn-open__spin" aria-hidden="true" />
      <span>Đang mở {text ? <b>{text}</b> : 'chức năng'}...</span>
    </div>
  );
}

function ScreenMessage({ menu, icon, title, detail, onRetry }) {
  return (
    <div className="page">
      <div className="placeholder">
        <div className="placeholder__icon placeholder__icon--warn"><Icon name={icon} size={28} /></div>
        <h2>{menu?.text}</h2>
        <p><b>{title}</b></p>
        <p>{detail}</p>
        <p className="hint">Menu_Id <code>{menu?.id}</code> · thủ tục <code>{MENU_PROC}</code></p>
        {onRetry && <button type="button" className="cy-btn" onClick={onRetry}>Thử lại</button>}
      </div>
    </div>
  );
}
