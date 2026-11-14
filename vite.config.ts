import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Совместная игра: запросы /api уходят на сервер из server/index.mjs (npm run server)
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
})
