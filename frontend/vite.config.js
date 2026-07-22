// vite.config.js
//
// Vite is the build tool that:
// - Runs the React dev server (npm run dev → localhost:5173)
// - Bundles everything for production (npm run build)
//
// The proxy setting here is important:
// When React makes a request to /api/..., Vite forwards it
// to the FastAPI backend on port 8000.
// This avoids CORS issues during development.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward /api requests to the FastAPI backend
      '/api': {
        target:    'http://localhost:8000',
        changeOrigin: true,
        rewrite:   (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
