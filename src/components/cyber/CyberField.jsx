/**
 * Khung bao chung cho mọi control: nhãn + control + thông báo lỗi.
 * Props chung: label, labelWidth, width, required, error, layout ('horizontal' | 'vertical'), className, style
 */
export default function CyberField({
  label, labelWidth = 120, width, required, error, layout = 'horizontal',
  className = '', style, htmlFor, children,
}) {
  return (
    <div
      className={`cy-field cy-field--${layout} ${error ? 'cy-field--error' : ''} ${className}`}
      style={{ width, ...style }}
    >
      {label !== undefined && (
        <label
          className="cy-field__label"
          htmlFor={htmlFor}
          style={layout === 'horizontal' ? { width: labelWidth, minWidth: labelWidth } : undefined}
        >
          {label}
          {required && <span className="cy-required">*</span>}
        </label>
      )}
      <div className="cy-field__body">
        {children}
        {error && <div className="cy-field__error">{error}</div>}
      </div>
    </div>
  );
}

let _uid = 0;
export const newId = (p = 'cy') => `${p}-${++_uid}`;
