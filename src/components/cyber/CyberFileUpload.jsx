import { useEffect, useRef, useState } from 'react';
import CyberField, { newId } from './CyberField';
import { useBinding } from '@/hooks/useBinding';
import { deleteFile, fileUrl, uploadFile } from '@/api/fileApi';
import { toast } from './CyberToast';

/**
 * CyberFileUpload – KÉO THẢ FILE để tải lên server (api/File/upload).
 * Cũng chọn được bằng cách bấm vào khung, hoặc dán (Ctrl+V) ảnh / file khi khung đang được chọn.
 *
 *   <CyberFileUpload {...form.bind('DinhKem')} label="Đính kèm" accept="image/*,.pdf,.xlsx" maxSize={10} maxFiles={5} />
 *
 * Giá trị (bind 2 chiều) = mảng file ĐÃ tải lên: [{ id, name, size, contentType, uploadedAt, url }]
 *   -> lưu các id vào DB cùng chứng từ; mở lại thì truyền mảng đó vào value để hiện lại danh sách.
 *
 * Props: label, accept, multiple (mặc định true), maxSize (MB, mặc định 20), maxFiles (mặc định 10),
 *        disabled, hint, user (người tải – gửi kèm lên server), deleteOnRemove (bấm ✕ thì xoá luôn trên server),
 *        onUploaded(files), onRemove(file) + props chung của CyberField (layout, labelWidth, required, error...)
 */
export default function CyberFileUpload(props) {
  const {
    accept = '', multiple = true, maxSize = 20, maxFiles = 10, disabled, hint, user,
    deleteOnRemove = false, onUploaded, onRemove,
  } = props;
  const [value, setValue] = useBinding(props);
  const files = Array.isArray(value) ? value : [];
  const filesRef = useRef(files);
  filesRef.current = files;

  const [queue, setQueue] = useState([]); // file đang tải / lỗi: { key, file, name, size, progress, status, error, preview, ctrl }
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const [over, setOver] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef(null);
  const [id] = useState(() => props.id || newId('upl'));
  const mounted = useRef(true);

  // Huỷ các lượt tải dở + giải phóng ảnh xem trước khi rời màn.
  // Phải bật lại mounted = true khi gắn: React StrictMode (dev) gỡ rồi gắn lại component 1 lần,
  // nếu không bật lại thì mọi kết quả tải lên bị bỏ qua (file lên server nhưng giao diện không hiện).
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueRef.current.forEach((it) => { it.ctrl?.abort(); if (it.preview) URL.revokeObjectURL(it.preview); });
    };
  }, []);

  const patch = (key, p) => mounted.current && setQueue((q) => q.map((it) => (it.key === key ? { ...it, ...p } : it)));

  /** Kiểm tra phía trình duyệt (server kiểm tra lại lần nữa) */
  const check = (file) => {
    if (file.size > maxSize * 1024 * 1024) return `Vượt quá ${maxSize} MB`;
    if (!file.size) return 'File rỗng';
    if (accept && !matchAccept(file, accept)) return 'Loại file không được phép';
    return null;
  };

  const start = (item) => {
    const ctrl = new AbortController();
    patch(item.key, { status: 'uploading', progress: 0, error: null, ctrl });
    uploadFile(item.file, { user, signal: ctrl.signal, silent: true, onProgress: (p) => patch(item.key, { progress: p }) })
      .then(([saved]) => {
        if (!mounted.current) return;
        const next = [...filesRef.current, saved];
        filesRef.current = next;
        setValue(next);
        setQueue((q) => q.filter((it) => it.key !== item.key));
        if (item.preview) URL.revokeObjectURL(item.preview);
        onUploaded?.(saved, next);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        patch(item.key, { status: 'error', error: err?.message || 'Tải lên thất bại' });
      });
  };

  const addFiles = (list) => {
    if (disabled) return;
    let incoming = Array.from(list || []);
    if (!incoming.length) return;
    if (!multiple) incoming = incoming.slice(0, 1);

    const room = maxFiles - filesRef.current.length - queue.filter((q) => q.status !== 'error').length;
    if (room <= 0) { toast.warning(`Chỉ được đính kèm tối đa ${maxFiles} file.`); return; }
    if (incoming.length > room) {
      toast.warning(`Chỉ được đính kèm tối đa ${maxFiles} file – bỏ qua ${incoming.length - room} file.`);
      incoming = incoming.slice(0, room);
    }

    // 1 file: thay file cũ
    if (!multiple && filesRef.current.length) {
      const old = filesRef.current[0];
      filesRef.current = [];
      setValue([]);
      if (deleteOnRemove) deleteFile(old.id, { silent: true }).catch(() => {});
    }

    const items = incoming.map((file) => {
      const error = check(file);
      return {
        key: newId('f'), file, name: file.name, size: file.size, progress: 0,
        status: error ? 'invalid' : 'uploading', error,
        preview: file.type.startsWith('image/') && !error ? URL.createObjectURL(file) : null,
      };
    });
    setQueue((q) => [...q, ...items]);
    items.filter((it) => it.status === 'uploading').forEach(start);
  };

  const removeDone = async (f) => {
    const next = filesRef.current.filter((x) => x.id !== f.id);
    filesRef.current = next;
    setValue(next);
    onRemove?.(f, next);
    if (deleteOnRemove) await deleteFile(f.id).catch(() => {});
  };
  const removeQueued = (it) => {
    it.ctrl?.abort();
    if (it.preview) URL.revokeObjectURL(it.preview);
    setQueue((q) => q.filter((x) => x.key !== it.key));
  };

  // ----- kéo thả -----
  const onDragEnter = (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current += 1; setOver(true); };
  const onDragOver = (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = disabled ? 'none' : 'copy'; };
  const onDragLeave = () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setOver(false); };
  const onDrop = (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setOver(false);
    addFiles(e.dataTransfer.files);
  };
  const onPaste = (e) => {
    const list = e.clipboardData?.files;
    if (list?.length) { e.preventDefault(); addFiles(list); }
  };

  const busy = queue.some((q) => q.status === 'uploading');
  const full = files.length + queue.filter((q) => q.status === 'uploading').length >= maxFiles;

  return (
    <CyberField {...props} htmlFor={id}>
      <div className={`cy-upload ${disabled ? 'is-disabled' : ''}`}>
        <div
          className={`cy-upload__zone ${over ? 'is-over' : ''} ${full ? 'is-full' : ''}`}
          role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled || undefined}
          aria-label="Kéo thả file vào đây hoặc bấm để chọn file"
          onClick={() => !disabled && !full && inputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled && !full) { e.preventDefault(); inputRef.current?.click(); } }}
          onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onPaste={onPaste}
        >
          <span className="cy-upload__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 7.97" />
              <path d="M12 12v8" /><path d="M8.5 15.5L12 12l3.5 3.5" />
            </svg>
          </span>
          <span className="cy-upload__title">
            {over ? 'Thả file vào đây' : full ? `Đã đủ ${maxFiles} file` : <>Kéo thả file vào đây hoặc <u>chọn file</u></>}
          </span>
          <span className="cy-upload__hint">
            {hint || [
              acceptLabel(accept),
              `tối đa ${maxSize} MB/file`,
              multiple ? `${maxFiles} file` : '1 file',
            ].filter(Boolean).join(' · ')}
            {!disabled && ' · Ctrl+V để dán'}
          </span>
          <input ref={inputRef} id={id} type="file" hidden multiple={multiple} accept={accept || undefined} disabled={disabled}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {(files.length > 0 || queue.length > 0) && (
          <ul className="cy-upload__list" aria-live="polite">
            {files.map((f) => (
              <FileRow key={f.id} name={f.name} size={f.size} type={f.contentType} status="done"
                href={fileUrl(f)} thumb={isImage(f.contentType, f.name) ? fileUrl(f) : null}
                downloadHref={fileUrl(f, { download: true })}
                onRemove={disabled ? null : () => removeDone(f)} />
            ))}
            {queue.map((it) => (
              <FileRow key={it.key} name={it.name} size={it.size} type={it.file.type} status={it.status}
                progress={it.progress} error={it.error} thumb={it.preview}
                onRetry={it.status === 'error' ? () => start(it) : null}
                onRemove={() => removeQueued(it)} />
            ))}
          </ul>
        )}
        {busy && <span className="cy-upload__busy" role="status">Đang tải lên...</span>}
      </div>
    </CyberField>
  );
}

function FileRow({ name, size, type, status, progress = 0, error, thumb, href, downloadHref, onRetry, onRemove }) {
  const kind = fileKind(type, name);
  return (
    <li className={`cy-upload__item is-${status}`}>
      <span className={`cy-upload__thumb cy-upload__thumb--${kind}`}>
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span>{extOf(name) || 'FILE'}</span>}
      </span>
      <span className="cy-upload__info">
        {href
          ? <a className="cy-upload__name" href={href} target="_blank" rel="noreferrer" title={`Mở ${name}`}>{name}</a>
          : <span className="cy-upload__name" title={name}>{name}</span>}
        <span className="cy-upload__meta">
          {formatSize(size)}
          {status === 'uploading' && ` · ${progress}%`}
          {status === 'done' && <span className="cy-upload__ok"> · Đã tải lên</span>}
          {(status === 'error' || status === 'invalid') && <span className="cy-upload__err"> · {error}</span>}
        </span>
        {status === 'uploading' && (
          <span className="cy-upload__bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${progress}%` }} />
          </span>
        )}
      </span>
      <span className="cy-upload__actions">
        {onRetry && <button type="button" className="cy-upload__btn" onClick={onRetry} title="Thử lại">↻</button>}
        {downloadHref && (
          <a className="cy-upload__btn" href={downloadHref} title="Tải về" aria-label={`Tải về ${name}`}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19h14" /></svg>
          </a>
        )}
        {onRemove && (
          <button type="button" className="cy-upload__btn cy-upload__btn--x" onClick={onRemove}
            title={status === 'uploading' ? 'Huỷ tải lên' : 'Bỏ file'} aria-label={`Bỏ ${name}`}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 7l10 10M17 7L7 17" /></svg>
          </button>
        )}
      </span>
    </li>
  );
}

// ----------------------------------------------------------------- helpers
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
const extOf = (name = '') => (name.includes('.') ? name.split('.').pop().toUpperCase().slice(0, 4) : '');
const isImage = (type = '', name = '') => type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);

function fileKind(type = '', name = '') {
  if (isImage(type, name)) return 'image';
  const ext = extOf(name).toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  if (['doc', 'docx', 'txt'].includes(ext)) return 'doc';
  if (['zip', 'rar', '7z'].includes(ext)) return 'zip';
  return 'other';
}

export function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** accept="image/*,.pdf,application/zip" giống thẻ input */
function matchAccept(file, accept) {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return accept.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

function acceptLabel(accept) {
  if (!accept) return '';
  return accept.split(',').map((s) => s.trim()).filter(Boolean)
    .map((r) => (r === 'image/*' ? 'ảnh' : r.startsWith('.') ? r.slice(1).toUpperCase() : r)).join(', ');
}
