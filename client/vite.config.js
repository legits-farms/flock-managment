import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev` serves plain http, which is enough on this PC: browsers allow the
// camera and GPS on http://localhost. A phone on the Wi-Fi needs https for them,
// so `npm run dev:https` adds a self-signed certificate (the browser warns once).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'https' ? [basicSsl()] : [])],
  server: {
    // Expose on the local network so the app can be opened on a phone
    host: true,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
}));
