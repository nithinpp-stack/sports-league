import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Auto-select number input content on focus to prevent leading-zero issue
document.addEventListener('focusin', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
    requestAnimationFrame(() => e.target.select());
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
