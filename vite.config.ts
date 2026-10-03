import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : l'app fonctionne aussi bien sur Vercel que sur GitHub Pages ou dans Capacitor (iOS/Android)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
