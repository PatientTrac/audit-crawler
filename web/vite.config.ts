import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: ['..'],  // allow importing fixtures + schema JSON from repo root
    },
    proxy: { '/api': 'http://localhost:8888' },  // netlify dev
  },
});
