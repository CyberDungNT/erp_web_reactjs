import Icon from '@/components/icons/Icon';

/** Trang tạm cho chức năng chưa có màn hình – hiện thông tin menu để dev biết cần làm gì */
export default function PlaceholderPage({ menu }) {
  return (
    <div className="page">
      <div className="placeholder">
        <div className="placeholder__icon"><Icon name="file" size={28} /></div>
        <h2>{menu?.text}</h2>
        <p>Chức năng này chưa có màn hình trên web.</p>
        <table className="placeholder__info">
          <tbody>
            <tr><th>Menu_Id</th><td><code>{menu?.id}</code></td></tr>
            <tr><th>Menu cha</th><td><code>{menu?.parentId || '—'}</code></td></tr>
            <tr><th>IsMaxForm</th><td>{menu?.isMaxForm ? '1' : '0'}</td></tr>
            <tr><th>isShowTab</th><td>{menu?.isShowTab ? '1' : '0'}</td></tr>
            {menu?.tag && <tr><th>Tag</th><td>{menu.tag}</td></tr>}
            {menu?.url && <tr><th>url</th><td>{menu.url}</td></tr>}
          </tbody>
        </table>
        <p className="hint">
          Khai báo trong <code>src/modules/&lt;phân-hệ&gt;/index.js</code> (mục <code>screens</code>):<br />
          <code>'{menu?.id}': lazy(() =&gt; import('./TenManPage')),</code>
        </p>
      </div>
    </div>
  );
}
