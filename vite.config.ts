import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config: React plugin only. Camera access needs localhost or HTTPS, which the dev server provides.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
});
