import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React libraries
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor-react';
          }
          // Firebase SDKs
          if (id.includes('firebase/app') || id.includes('firebase/auth') || id.includes('firebase/firestore')) {
            return 'vendor-firebase';
          }
          // TanStack Query
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query';
          }
          // Lucide icons
          if (id.includes('lucide-react')) {
            return 'vendor-lucide';
          }
          // Utility libraries
          if (id.includes('date-fns') || id.includes('zod')) {
            return 'vendor-utils';
          }
          // PDF/Document processing (heavy, loaded on demand)
          if (id.includes('pdfjs-dist') || id.includes('mammoth') || id.includes('pptx2json')) {
            return 'vendor-doc';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
