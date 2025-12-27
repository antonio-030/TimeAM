import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Proxy API requests to backend during development
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Erhöhe Limit auf 1MB (aktuell: 1.14MB)
    rollupOptions: {
      output: {
        manualChunks: {
          // Firebase in separaten Chunk
          'firebase-core': ['firebase/app', 'firebase/auth'],
          'firebase-other': ['firebase/app-check', 'firebase/analytics'],
          // React Router
          'react-router': ['react-router-dom'],
          // FullCalendar
          'fullcalendar': [
            '@fullcalendar/core',
            '@fullcalendar/react',
            '@fullcalendar/daygrid',
            '@fullcalendar/timegrid',
            '@fullcalendar/list',
            '@fullcalendar/interaction',
          ],
        },
      },
    },
  },
});

