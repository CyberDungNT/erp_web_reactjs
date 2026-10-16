import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { installErrorReporter } from '@/utils/errorReporter';
import { cleanLocalStorage } from '@/utils/storage';
import '@/styles/theme.css';
import '@/styles/index.css';

// Lỗi API / binding / lỗi JS / console.error -> toast (cấu hình trong utils/errorReporter.js)
installErrorReporter();
// localStorage chỉ giữ cyber_auth, cyber_device_id, cyber_sidebar_width, cyber_sidebar_collapsed – xoá mọi khoá khác
cleanLocalStorage();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
