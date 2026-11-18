import { ApiError, errorFromResponse, networkError } from './errors'

/**
 * То, что api-client знает о сессии. Передаётся снаружи, поэтому модуль не импортирует
 * session и цикла зависимостей нет (docs/specs/architecture.md).
 */
export interface SessionBridge {
  getAccessToken(): string | null
  /**
   * Обновляет пару токенов. Resolve — новая пара сохранена; reject с `ApiError` — сервер
   * отказал в refresh (`isSessionRejected`) либо обновление не удалось (сеть, 5xx).
   */
  refresh(): Promise<void>
  /** Сервер отверг refresh — единственный случай, когда клиент разлогинивается. */
  onSessionRejected(): void
}

export interface RequestOptions {
  body?: unknown
  /** Тело отправляется как application/x-www-form-urlencoded (только /auth/login). */
  form?: Record<string, string>
  /** Запросы авторизации не запускают refresh и не повторяются. */
  isAuthRequest?: boolean
  signal?: AbortSignal
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/**
 * Realtime живёт на том же адресе, что и HTTP: в разработке `/api/ws` идёт через Vite-прокси
 * на `/ws` бэкенда. Отдельная переменная нужна, только если сокеты обслуживает другой хост.
 */
const SOCKET_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? BASE_URL

/** Абсолютный ws(s)-адрес: относительная база достраивается от адреса страницы. */
export function socketUrl(
  path: string,
  params: Record<string, string>,
  base: string = SOCKET_BASE_URL,
  pageUrl: string = globalThis.location.href,
): string {
  const url = new URL(`${base}${path}`, pageUrl)
  if (url.protocol === 'https:') url.protocol = 'wss:'
  if (url.protocol === 'http:') url.protocol = 'ws:'
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

export class ApiClient {
  private session: SessionBridge | null = null
  private refreshing: Promise<void> | null = null

  setSession(session: SessionBridge): void {
    this.session = session
  }

  /** Access-токен для транспорта вне `fetch` (realtime-сокет). */
  accessToken(): string | null {
    return this.session?.getAccessToken() ?? null
  }

  /**
   * Обновление пары по тем же правилам, что и при 401: один refresh на всех, разлогин —
   * только по отказу сервера (архитектура, инвариант 3), сеть и 5xx пару не трогают.
   */
  async refreshSession(): Promise<void> {
    const session = this.session
    if (!session) throw new ApiError(401, 'not_authenticated', 'No session')
    try {
      await this.refreshOnce()
    } catch (cause) {
      if (cause instanceof ApiError && cause.isSessionRejected) session.onSessionRejected()
      throw cause instanceof ApiError ? cause : networkError(cause)
    }
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const session = this.session
    // Токен, с которым ушёл запрос: если к моменту 401 он уже сменился, обновлять нечего.
    const tokenUsed = session?.getAccessToken() ?? null
    const response = await this.send(method, path, options, tokenUsed)

    if (response.status === 401 && !options.isAuthRequest && session) {
      if (session.getAccessToken() === tokenUsed) await this.refreshSession()

      const retried = await this.send(method, path, options, session.getAccessToken())
      // Повторный 401 после успешного refresh — ошибка, а не новый цикл.
      if (retried.status === 401) throw await this.toError(retried)
      return this.toData<T>(retried)
    }

    return this.toData<T>(response)
  }

  /** Один refresh на все параллельные 401: остальные ждут тот же результат. */
  private refreshOnce(): Promise<void> {
    if (!this.refreshing) {
      this.refreshing = this.session!.refresh().finally(() => {
        this.refreshing = null
      })
    }
    return this.refreshing
  }

  private async send(
    method: string,
    path: string,
    options: RequestOptions,
    token: string | null,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    let body: BodyInit | undefined

    if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      body = new URLSearchParams(options.form).toString()
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(options.body)
    }

    if (token && !options.isAuthRequest) headers.Authorization = `Bearer ${token}`

    try {
      return await fetch(`${BASE_URL}${path}`, { method, headers, body, signal: options.signal })
    } catch (cause) {
      throw networkError(cause)
    }
  }

  private async toData<T>(response: Response): Promise<T> {
    if (!response.ok) throw await this.toError(response)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  private async toError(response: Response): Promise<ApiError> {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = null
    }
    return errorFromResponse(response.status, body)
  }
}

export const api = new ApiClient()
