import type { ErrorBody } from './types'

/**
 * Единственный тип ошибки, который видят экраны. Сетевая ошибка и 5xx тоже
 * становятся ApiError: для интерфейса это одна ветка «не удалось загрузить».
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** Сессия закрыта сервером — единственный случай, когда клиент разлогинивается. */
  get isSessionRejected(): boolean {
    return this.status === 401 && this.code === 'invalid_refresh_token'
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'Bad request',
  401: 'Authentication required',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  422: 'Validation failed',
  500: 'Server error',
}

export function errorFromResponse(status: number, body: unknown): ApiError {
  const parsed = body as Partial<ErrorBody> | null
  if (parsed && typeof parsed.error === 'string') {
    return new ApiError(status, parsed.error, parsed.message ?? parsed.error, parsed.details)
  }
  return new ApiError(
    status,
    status >= 500 ? 'server_error' : 'unknown',
    FALLBACK_MESSAGES[status] ?? 'Request failed',
  )
}

export function networkError(cause: unknown): ApiError {
  const message = cause instanceof Error ? cause.message : 'Network request failed'
  return new ApiError(0, 'network_error', message, cause)
}
