import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global error and promise rejection listeners for easy debugging/diagnostics
window.onerror = function (message, source, lineno, colno, error) {
    console.error("🔥 GLOBAL UNCAUGHT ERROR:", message, "at", source, ":", lineno, ":", colno, error);
};

window.addEventListener('unhandledrejection', function (event) {
    console.error("🌊 GLOBAL UNHANDLED REJECTION:", event.reason);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
