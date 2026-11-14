import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // @/ означает src/: вместо цепочек ../../
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Совместная игра: запросы /api уходят на сервер из server/index.mjs (npm run server)
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
})
