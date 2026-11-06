/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Прокси убирает CORS в разработке: браузер видит один origin, а Vite переписывает
// /api/* на бэкенд. Для прод-сборки адрес задаётся через VITE_API_BASE_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
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
