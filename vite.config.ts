import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      // REST API routes → FastAPI UC3 backend at localhost:8030
      '/api': {
        target: 'http://localhost:8030',
        changeOrigin: true,
        secure: false,
      },
      // WebSocket routes → FastAPI UC3 backend at localhost:8030
      '/ws': {
        target: 'ws://localhost:8030',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
