import { defineConfig, devices } from '@playwright/test'

/** Отдельный порт, чтобы e2e не мешал запущенному вручную `npm run dev`. */
export const E2E_PORT = 5174
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`

/**
 * E2E идёт против живого бэкенда: Vite-прокси переписывает `/api/*` на `http://localhost:8000`,
 * поэтому бэкенд должен быть запущен, а фронт Playwright поднимает сам.
 * Браузер — установленный Chrome: бандл Chromium от Playwright требует отдельной загрузки.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Пользователи регистрируются в общей базе, поэтому прогоны не размножаем.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: E2E_BASE_URL,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT} --strictPort`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
