import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite 7 deja Safari <16 fuera de su target predeterminado.
  // Bajar el objetivo amplía compatibilidad de iPhone X/11 con iOS antiguo.
  build: {
    target: "es2018",
    cssTarget: "safari13",
  },
  optimizeDeps: {
    include: ['tesseract.js'],
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
