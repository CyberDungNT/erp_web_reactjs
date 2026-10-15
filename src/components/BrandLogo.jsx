import { BRAND } from '../config/brand';

/**
 * Logo thương hiệu. Có BRAND.logoUrl -> dùng ảnh; không có -> logo chữ (chữ nghiêng xanh + nét cam).
 */
export default function BrandLogo({ className = '' }) {
  if (BRAND.logoUrl) {
    return <img src={BRAND.logoUrl} alt={BRAND.logoText} className={`brand-logo-img ${className}`} />;
  }
  return (
    <div className={`brand-logo ${className}`} aria-label={BRAND.logoText}>
      <div className="brand-logo__row">
        <span className="brand-logo__word">{BRAND.logoText}</span>
        <svg className="brand-logo__mark" viewBox="0 0 26 40" aria-hidden="true">
          <path d="M19 1 6 24h8L9 39 23 14h-8z" fill="#ff990a" />
          <path d="M23 1 14 17h4l-4 9 9-14h-4z" fill="#00d287" opacity=".9" />
        </svg>
      </div>
      <span className="brand-logo__tag">{BRAND.tagline}</span>
    </div>
  );
}
