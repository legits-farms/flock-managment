import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // Camera and GPS only work on https, so the dev server uses a self-signed certificate
  plugins: [react(), basicSsl()],
  server: {
    // Expose on the local network so the app can be opened on a phone
    host: true,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
