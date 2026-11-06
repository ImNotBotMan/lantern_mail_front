import type { TokenResponse } from '../../api/types'

/**
 * Пара токенов: access живёт только в памяти модуля, refresh — в localStorage
 * (docs/specs/architecture.md, «Access в памяти, refresh в localStorage»).
 * Бэкенд не ставит httpOnly-cookie, поэтому хранить refresh надёжнее негде.
 */
export const REFRESH_TOKEN_KEY = 'lantern.refresh'

let accessToken: string | null = null

/** localStorage может быть недоступен (приватный режим, тесты) — без него сессия живёт до перезагрузки. */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function getAccessToken(): string | null {
  return accessToken
}

export function getRefreshToken(): string | null {
  try {
    return storage()?.getItem(REFRESH_TOKEN_KEY) ?? null
  } catch {
    return null
  }
}

/** Пара меняется только вместе: записанный refresh заменяет предыдущий целиком. */
export function setTokens({ access_token, refresh_token }: TokenResponse): void {
  accessToken = access_token
  try {
    storage()?.setItem(REFRESH_TOKEN_KEY, refresh_token)
  } catch {
    // Записать некуда — access всё равно работает до перезагрузки страницы.
  }
}

export function clearTokens(): void {
  accessToken = null
  try {
    storage()?.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // Стирать нечего.
  }
}
