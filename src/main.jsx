import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { installErrorReporter } from '@/utils/errorReporter';
import '@/styles/theme.css';
import '@/styles/index.css';

// Lỗi API / binding / lỗi JS / console.error -> toast (cấu hình trong utils/errorReporter.js)
installErrorReporter();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
