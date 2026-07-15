/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served at lukelakea.com/kaiwa via a reverse-proxy route in the portfolio's
// vercel.json, which strips the "/kaiwa" prefix before forwarding — so this
// project's own asset URLs must include it (matching griddit-V2 and JP
// Pronunciation App's same setup). Vercel's local dev proxy already strips the
// prefix before it reaches Vite, so dev serves at "/" like normal.
const isVercelDev = process.env.VERCEL_ENV === 'development';
const base = isVercelDev ? '/' : '/kaiwa/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  test: {
    // jsdom gives the hook tests a DOM (React state) and the client tests a
    // `fetch` to stub. Tests are unit-level: no live backend or model.
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
