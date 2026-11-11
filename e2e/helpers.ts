import { expect } from '@playwright/test'
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test'

/** Бэкенд e2e ходит напрямую, минуя Vite-прокси: так пользователи готовятся одним запросом. */
export const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:8000'
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

/** Москва из сеяного справочника: город обязателен, чтобы продукты вроде письма работали. */
export const DEFAULT_CITY_ID = 1

/**
 * Пользователь создаётся через API: сценарий проверяет вход и сессию, а не форму регистрации.
 * Город проставляется тем же API, что и экран выбора: `cityId: null` оставляет пользователя
 * без города — так проверяется сам шаг выбора.
 */
export async function createUser(
  request: APIRequestContext,
  user: E2EUser = newUser(),
  cityId: number | null = DEFAULT_CITY_ID,
): Promise<E2EUser> {
  const response = await request.post(`${API_BASE_URL}/auth/register`, { data: user })
  if (!response.ok()) {
    throw new Error(
      `Не удалось создать пользователя: ${response.status()} ${await response.text()}`,
    )
  }
  if (cityId === null) return user

  const token = ((await response.json()) as { access_token: string }).access_token
  const withCity = await request.patch(`${API_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { city_id: cityId },
  })
  if (!withCity.ok()) {
    throw new Error(`Не удалось выбрать город: ${withCity.status()} ${await withCity.text()}`)
  }
  return user
}

/** Выбор города на экране онбординга: дальше продукт доступен только с городом. */
export async function chooseCity(page: Page, city: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Выберите город' })).toBeVisible()
  // Радиокнопка справочника визуально спрятана внутри подписи: пользователь кликает по подписи
  await page.locator('label', { hasText: city }).click()
  await expect(page.getByRole('radio', { name: new RegExp(city) })).toBeChecked()
  await page.getByRole('button', { name: 'Сохранить' }).click()
}

/** Второй браузерный контекст: свои cookie и localStorage, как другое устройство. */
export function newContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ baseURL: WEB_BASE_URL, locale: 'ru-RU' })
}

/** Access-токен через API: подготовка сценариев не зависит от экранов входа. */
export async function apiAccessToken(request: APIRequestContext, user: E2EUser): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    form: { username: user.email, password: user.password },
  })
  if (!response.ok()) {
    throw new Error(`Не удалось войти через API: ${response.status()} ${await response.text()}`)
  }
  return ((await response.json()) as { access_token: string }).access_token
}

/** Дружба через API: e2e проверяет список друзей, а не форму заявки. */
export async function befriend(
  request: APIRequestContext,
  sender: E2EUser,
  recipient: E2EUser,
): Promise<void> {
  const senderToken = await apiAccessToken(request, sender)
  const recipientToken = await apiAccessToken(request, recipient)

  const sent = await request.post(`${API_BASE_URL}/friends/requests`, {
    headers: { Authorization: `Bearer ${senderToken}` },
    data: { recipient_username: recipient.username },
  })
  if (!sent.ok()) {
    throw new Error(`Не удалось отправить заявку: ${sent.status()} ${await sent.text()}`)
  }

  const incoming = await request.get(`${API_BASE_URL}/friends/requests/incoming`, {
    headers: { Authorization: `Bearer ${recipientToken}` },
  })
  const requests = (await incoming.json()) as { id: string; sender_username: string }[]
  const requestId = requests.find((item) => item.sender_username === sender.username)?.id
  if (!requestId) throw new Error('Получатель не видит заявку')

  const accepted = await request.post(`${API_BASE_URL}/friends/requests/${requestId}/accept`, {
    headers: { Authorization: `Bearer ${recipientToken}` },
  })
  if (!accepted.ok()) {
    throw new Error(`Не удалось принять заявку: ${accepted.status()} ${await accepted.text()}`)
  }
}

export async function signIn(page: Page, user: E2EUser): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Пароль').fill(user.password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  // Ждём, пока приложение действительно открылось: после входа с городом это входящие,
  // без города — шаг выбора. Иначе следующий шаг сценария угонится за навигацией.
  await expect(page.getByRole('heading', { name: /Входящие|Выберите город/ })).toBeVisible()
}
