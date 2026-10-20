import { useEffect, useState } from 'react';

/** Ảnh đại diện tròn: có Url_Avatar thì hiện ảnh; chưa có / ảnh lỗi -> chữ cái đầu (initial) */
export default function AvatarImage({ url, initial, className = '' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  if (!url || broken) return <>{initial}</>;
  return <img className={`mn__avatar-img ${className}`} src={url} alt="" onError={() => setBroken(true)} draggable={false} />;
}
