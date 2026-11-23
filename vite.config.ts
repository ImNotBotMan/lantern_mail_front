/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// Прокси убирает CORS в разработке: браузер видит один origin, а Vite переписывает
// /api/* на бэкенд. Для прод-сборки адрес задаётся через VITE_API_BASE_URL.
// `API_PROXY_TARGET` позволяет направить разработку и e2e на другой бэкенд (например, с
// короткой задержкой доставки), не трогая конфиг.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `@/` — корень `src`: так импортируют компоненты, которые ставит shadcn (components.json).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        // Realtime-шина `/ws` бэкенда открывается как `/api/ws` и идёт тем же прокси.
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    // jsdom без собственного origin не даёт localStorage, а сессия на нём и держится.
    environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // e2e-сценарии принадлежат Playwright: vitest их не собирает и не запускает.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
