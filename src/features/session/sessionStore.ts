import { api } from '../../api/client'
import type { SessionBridge } from '../../api/client'
import { authApi } from '../../api/endpoints/auth'
import { usersApi } from '../../api/endpoints/users'
import { ApiError } from '../../api/errors'
import type { RegisterRequest, TokenResponse, UserResponse } from '../../api/types'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens'

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

export interface SessionSnapshot {
  status: SessionStatus
  user: UserResponse | null
  /** Почему не удалось проверить сессию при загрузке: экран предлагает повторить, не разлогинивая. */
  error: ApiError | null
}

const INITIAL: SessionSnapshot = { status: 'loading', user: null, error: null }

let snapshot: SessionSnapshot = INITIAL
const listeners = new Set<() => void>()
let bootstrapped = false

function emit(next: SessionSnapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSessionSnapshot(): SessionSnapshot {
  return snapshot
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  return new ApiError(0, 'unknown', error instanceof Error ? error.message : 'Unknown error')
}

/**
 * Обновляет пару токенов. Отказ сервера приходит как `invalid_refresh_token` (сессия
 * закрыта), сеть и 5xx — тоже ошибкой, но пара при этом остаётся.
 */
async function refreshTokens(): Promise<void> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    throw new ApiError(401, 'invalid_refresh_token', 'No refresh token stored')
  }
  setTokens(await authApi.refresh(refreshToken))
}

/** Локально закрывает сессию: пара стирается, экраны уходят на вход. */
function closeSession(): void {
  clearTokens()
  emit({ status: 'anonymous', user: null, error: null })
}

const bridge: SessionBridge = {
  getAccessToken,
  refresh: refreshTokens,
  onSessionRejected: closeSession,
}

api.setSession(bridge)

async function restoreSession(): Promise<void> {
  if (!getRefreshToken()) {
    closeSession()
    return
  }

  try {
    await refreshTokens()
    emit({ status: 'authenticated', user: await usersApi.me(), error: null })
  } catch (error) {
    const apiError = toApiError(error)
    // Разлогин — только по отказу сервера (архитектура, инвариант 3).
    if (apiError.isSessionRejected) {
      closeSession()
      return
    }
    emit({ status: 'loading', user: null, error: apiError })
  }
}

/**
 * Тихая проверка сессии при загрузке страницы. Одна на вкладку: повторный refresh отозвал бы
 * пару, которую только что выдал предыдущий (бэкенд считает это кражей).
 */
export function bootstrapSession(): Promise<void> {
  if (bootstrapped) return Promise.resolve()
  bootstrapped = true
  return restoreSession()
}

/** Повтор проверки после сетевой ошибки: сессия не закрыта, пара на месте. */
export function retryBootstrapSession(): Promise<void> {
  bootstrapped = false
  emit(INITIAL)
  return bootstrapSession()
}

async function startSession(tokens: TokenResponse): Promise<void> {
  setTokens(tokens)
  try {
    emit({ status: 'authenticated', user: await usersApi.me(), error: null })
  } catch (error) {
    // Без профиля сессия не считается открытой: иначе guard пустит экраны без пользователя.
    clearTokens()
    throw error
  }
}

export async function login(email: string, password: string): Promise<void> {
  await startSession(await authApi.login(email, password))
}

export async function register(data: RegisterRequest): Promise<void> {
  await startSession(await authApi.register(data))
}

/**
 * Явный выход срабатывает всегда: пара стирается до запроса, поэтому обрыв сети не держит
 * пользователя внутри. Если запрос не дошёл, refresh живёт на сервере до истечения срока.
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken()
  closeSession()
  if (!refreshToken) return
  await authApi.logout(refreshToken).catch(() => undefined)
}

/** Выход на всех устройствах нужен access-токен, поэтому сначала сервер, потом локальная очистка. */
export async function logoutAll(): Promise<void> {
  await authApi.logoutAll()
  closeSession()
}

/** Только для тестов: возвращает модуль в состояние «до загрузки страницы». */
export function resetSessionForTests(): void {
  bootstrapped = false
  clearTokens()
  emit(INITIAL)
}
