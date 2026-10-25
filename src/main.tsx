import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/theme.css';
import './styles/tour.css';
import { applyTheme, applyToolbarStyle, loadThemeMode, loadToolbarStyle } from './lib/theme';

// 在首屏渲染前应用主题，避免深色模式闪白
applyTheme(loadThemeMode());
applyToolbarStyle(loadToolbarStyle());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
