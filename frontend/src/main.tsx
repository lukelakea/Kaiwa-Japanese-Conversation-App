import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Bundle Noto Sans JP locally (no network dependency — local-first, brief §2).
// Import the unsplit latin/japanese subset files rather than the default
// `400.css` etc., which fragment the Japanese range into 100+ unicode-range
// chunks. As new kanji stream in mid-conversation, each chunk's separate
// `font-display: swap` fires its own reflow, which reads as text randomly
// flickering across the page. One file per weight = one swap, at load time.
import '@fontsource/noto-sans-jp/latin-400.css';
import '@fontsource/noto-sans-jp/latin-500.css';
import '@fontsource/noto-sans-jp/latin-700.css';
import '@fontsource/noto-sans-jp/japanese-400.css';
import '@fontsource/noto-sans-jp/japanese-500.css';
import '@fontsource/noto-sans-jp/japanese-700.css';
import './index.css';

import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
