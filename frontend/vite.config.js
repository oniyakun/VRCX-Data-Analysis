import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: './src/main.jsx'
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@mui/material', 'axios', 'xlsx']
  }
});