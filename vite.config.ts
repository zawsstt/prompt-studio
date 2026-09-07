import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',  // 使用相对路径，让 dist 可以在任意路径下打开
  server: {
    port: 3000,
    host: true,
  },
});
