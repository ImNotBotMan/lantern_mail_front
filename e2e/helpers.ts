import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test'

/** Бэкенд e2e ходит напрямую, минуя Vite-прокси: так пользователи готовятся одним запросом. */
const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8000'
const WEB_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5174'

export interface E2EUser {
  email: string
  username: string
  password: string
}

let sequence = 0

/** Уникальный пользователь на прогон: база бэкенда общая, повторный email или username не пройдёт. */
export function newUser(): E2EUser {
  sequence += 1
  const stamp = `${Date.now().toString(36)}${sequence}`.toLowerCase()
  return {
    email: `e2e.${stamp}@example.com`,
    username: `e2e_${stamp}`.slice(0, 32),
    password: 'password123',
  }
}

/** Пользователь создаётся через API: сценарий проверяет вход и сессию, а не форму регистрации. */
export async function createUser(
  request: APIRequestContext,
  user: E2EUser = newUser(),
): Promise<E2EUser> {
  const response = await request.post(`${API_BASE_URL}/auth/register`, { data: user })
  if (!response.ok()) {
    throw new Error(`Не удалось создать пользователя: ${response.status()} ${await response.text()}`)
  }
  return user
}

/** Второй браузерный контекст: свои cookie и localStorage, как другое устройство. */
export function newContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ baseURL: WEB_BASE_URL, locale: 'ru-RU' })
}

export async function signIn(page: Page, user: E2EUser): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Пароль').fill(user.password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
}
