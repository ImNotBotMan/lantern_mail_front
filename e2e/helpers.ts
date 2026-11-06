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

/** Access-токен через API: подготовка сценариев не зависит от экранов входа. */
export async function apiAccessToken(
  request: APIRequestContext,
  user: E2EUser,
): Promise<string> {
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

  const accepted = await request.post(
    `${API_BASE_URL}/friends/requests/${requestId}/accept`,
    { headers: { Authorization: `Bearer ${recipientToken}` } },
  )
  if (!accepted.ok()) {
    throw new Error(`Не удалось принять заявку: ${accepted.status()} ${await accepted.text()}`)
  }
}

export async function signIn(page: Page, user: E2EUser): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Пароль').fill(user.password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
}
