import { useEffect, useRef, useState } from 'react';
import { EMOJI_GROUPS, STICKER_PACKS, getRecentEmoji, pushRecentEmoji } from './stickers';

/**
 * Bảng chọn biểu tượng cảm xúc / nhãn dán (mở từ nút trên ô nhập tin).
 *   tab = 'emoji'   -> bấm emoji: onEmoji(e) (chèn vào ô nhập, bảng vẫn mở để chọn tiếp)
 *   tab = 'sticker' -> bấm nhãn dán: onSticker(packId, itemId) (gửi ngay, đóng bảng)
 * Đóng: Esc, bấm ra ngoài.
 */
export default function ChatPicker({ tab, onTab, onEmoji, onSticker, onClose }) {
  const ref = useRef(null);
  const [group, setGroup] = useState(getRecentEmoji().length ? 'recent' : EMOJI_GROUPS[0].id);
  const [pack, setPack] = useState(STICKER_PACKS[0].id);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || e.target.closest?.('.chat__tool')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose]);

  const recent = getRecentEmoji();
  const groups = recent.length ? [{ id: 'recent', name: 'Dùng gần đây', icon: '🕘', list: recent }, ...EMOJI_GROUPS] : EMOJI_GROUPS;
  const curGroup = groups.find((g) => g.id === group) || groups[0];
  const curPack = STICKER_PACKS.find((p) => p.id === pack) || STICKER_PACKS[0];

  return (
    <div className="chat-pk" ref={ref} role="dialog" aria-label={tab === 'emoji' ? 'Biểu tượng cảm xúc' : 'Nhãn dán'}>
      <div className="chat-pk__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'sticker'} className={tab === 'sticker' ? 'is-on' : ''} onClick={() => onTab('sticker')}>Nhãn dán</button>
        <button type="button" role="tab" aria-selected={tab === 'emoji'} className={tab === 'emoji' ? 'is-on' : ''} onClick={() => onTab('emoji')}>Biểu tượng cảm xúc</button>
      </div>

      {tab === 'emoji' ? (
        <>
          <div className="chat-pk__title">{curGroup.name}</div>
          <div className="chat-pk__grid chat-pk__grid--emoji">
            {curGroup.list.map((e) => (
              <button key={e} type="button" className="chat-pk__emoji" title={e}
                onClick={() => { pushRecentEmoji(e); onEmoji(e); }}>{e}</button>
            ))}
          </div>
          <div className="chat-pk__cats">
            {groups.map((g) => (
              <button key={g.id} type="button" title={g.name} aria-label={g.name}
                className={g.id === curGroup.id ? 'is-on' : ''} onClick={() => setGroup(g.id)}>{g.icon}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="chat-pk__title">{curPack.name}</div>
          <div className="chat-pk__grid chat-pk__grid--sticker">
            {curPack.items.map((s) => (
              <button key={s.id} type="button" className="chat-pk__sticker" title={s.t || s.e}
                onClick={() => onSticker(curPack.id, s.id)}>
                <span className="chat-pk__sticker-e">{s.e}</span>
                {s.t && <span className="chat-pk__sticker-t">{s.t}</span>}
              </button>
            ))}
          </div>
          <div className="chat-pk__cats">
            {STICKER_PACKS.map((p) => (
              <button key={p.id} type="button" title={p.name} aria-label={p.name}
                className={p.id === curPack.id ? 'is-on' : ''} onClick={() => setPack(p.id)}>{p.icon}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
