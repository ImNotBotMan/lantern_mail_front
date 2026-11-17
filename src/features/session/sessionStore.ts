import { api } from '../../api/client'
import type { SessionBridge } from '../../api/client'
import { authApi } from '../../api/endpoints/auth'
import { usersApi } from '../../api/endpoints/users'
import { ApiError } from '../../api/errors'
import type {
  RegisterRequest,
  RegisterResponse,
  TokenResponse,
  UserResponse,
} from '../../api/types'
import { signInWithGoogle } from '../../shared/firebase'
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

/**
 * Вход через Google: окно Firebase даёт ID-токен, сервер меняет его на нашу пару.
 * Ошибки окна (закрыл, заблокировано) — `GoogleSignInError`, отказ сервера — `ApiError`.
 */
export async function loginWithGoogle(): Promise<void> {
  await startSession(await authApi.firebaseLogin(await signInWithGoogle()))
}

/**
 * Регистрация сессию не открывает: без подтверждённого адреса токенов не выдаёт никто.
 * Экран показывает «проверьте почту» и адрес, на который ушло письмо.
 */
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  return authApi.register(data)
}

/**
 * Письмо подтверждения: сервер отправляет его на каждой попытке входа без подтверждения,
 * поэтому отдельного эндпоинта нет — повторяем вход.
 *
 * `verified` — адрес уже подтвердили, и вход состоялся: экран уводит в продукт.
 */
export async function resendVerification(
  email: string,
  password: string,
): Promise<'sent' | 'verified'> {
  try {
    await login(email, password)
    return 'verified'
  } catch (error) {
    if (error instanceof ApiError && error.code === 'email_not_verified') return 'sent'
    throw error
  }
}

/** Сброс пароля: письмо и страницу смены отдаёт Firebase, наш API только просит его отправить. */
export async function requestPasswordReset(email: string): Promise<void> {
  await authApi.requestPasswordReset(email)
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

/**
 * Обновляет профиль в уже открытой сессии — после изменения данных, например города.
 * Сессию не открывает и не закрывает: если пользователь анонимен, вызов ничего не делает.
 */
export function updateUser(user: UserResponse): void {
  if (snapshot.status !== 'authenticated') return
  emit({ ...snapshot, user })
}

/** Только для тестов: возвращает модуль в состояние «до загрузки страницы». */
export function resetSessionForTests(): void {
  bootstrapped = false
  clearTokens()
  emit(INITIAL)
}
