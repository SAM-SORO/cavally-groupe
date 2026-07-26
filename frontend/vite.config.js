import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Le front appelle /api en relatif : en dev, Vite proxifie vers FastAPI.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
