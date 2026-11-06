import {
  bootstrapSession,
  login as loginSession,
  resetSessionForTests,
} from '../features/session/sessionStore'
import { REFRESH_TOKEN_KEY } from '../features/session/tokens'
import { tokens } from './msw/handlers'

/** Открывает сессию настоящим входом по MSW: экраны видят то же состояние, что в приложении. */
export async function signInForTest(
  email = 'me@example.com',
  password = 'password123',
): Promise<void> {
  resetSessionForTests()
  await loginSession(email, password)
}

export function signOutForTest(): void {
  resetSessionForTests()
}

/**
 * Имитация перезагрузки страницы: refresh остался в хранилище, access и состояние — нет.
 * Возвращает промис тихого bootstrap'а, чтобы тест мог его дождаться.
 */
export function reloadForTest(refreshToken: string = tokens.refresh_token): Promise<void> {
  resetSessionForTests()
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  return bootstrapSession()
}
