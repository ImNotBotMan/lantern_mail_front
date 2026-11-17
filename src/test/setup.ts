import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import { resetSessionForTests } from '../features/session'
import '../shared/i18n'
import { server } from './msw/server'

/**
 * Node 25 держит собственный `globalThis.localStorage`, который в jsdom-окружении перекрывает
 * хранилище jsdom: объект есть, а `setItem` в нём нет. В браузере такого нет, но сессия
 * в тестах без настоящего Storage не живёт — подставляем хранилище в памяти.
 */
function installMemoryStorage(): void {
  const data = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return data.size
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, String(value))
    },
    removeItem: (key) => {
      data.delete(key)
    },
    clear: () => {
      data.clear()
    },
  }

  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
}

if (typeof globalThis.localStorage?.setItem !== 'function') installMemoryStorage()

/**
 * Окно Firebase в jsdom не открыть, а seam у него ровно один — `signInWithGoogle`.
 * Мок объявлен здесь, потому что setup грузит sessionStore раньше тестов: объявленный
 * в тесте мок до этой связи уже не доходит. `enableGoogle()` в тестах подставляет env.
 */
vi.mock('../shared/firebase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/firebase')>()
  return { ...actual, signInWithGoogle: vi.fn() }
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetSessionForTests())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
