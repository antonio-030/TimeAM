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
    // Erhöhe Chunk-Größen-Warnung (1.2 MB nach minification ist für eine moderne App akzeptabel)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manuelle Chunk-Aufteilung für bessere Performance
        manualChunks: {
          // React und React-DOM in separaten Chunk
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Firebase in separaten Chunk
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/analytics', 'firebase/app-check'],
          // FullCalendar in separaten Chunk
          'fullcalendar-vendor': [
            '@fullcalendar/core',
            '@fullcalendar/react',
            '@fullcalendar/daygrid',
            '@fullcalendar/timegrid',
            '@fullcalendar/list',
            '@fullcalendar/interaction',
          ],
          // Andere große Bibliotheken
          'utils-vendor': ['otplib', 'qrcode.react'],
        },
      },
      // Unterdrücke Warnungen über dynamische/statische Imports (nicht kritisch)
      onwarn(warning, warn) {
        // Ignoriere Warnungen über dynamische/statische Imports
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || warning.message.includes('dynamically imported')) {
          return;
        }
        // Zeige alle anderen Warnungen
        warn(warning);
      },
    },
  },
});

