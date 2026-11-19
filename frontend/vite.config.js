import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // in development the API runs on its own port; built, the backend serves both
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
