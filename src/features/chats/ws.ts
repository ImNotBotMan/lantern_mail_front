import { ApiError, api, conversationsApi } from '../../api'
import type { LetterEvent, LetterEventType } from '../../api'

/** Сервер закрывает сокет этим кодом, если токен невалиден или отсутствует. */
export const SESSION_CLOSE_CODE = 4401

export const PING_INTERVAL_MS = 25_000
export const RETRY_BASE_MS = 1_000
export const RETRY_MAX_MS = 30_000

const EVENT_TYPES: readonly LetterEventType[] = ['letter.sent', 'letter.delivered', 'letter.read']

export interface ChatSocketHandlers {
  onEvent(event: LetterEvent): void
  /**
   * Соединение восстановлено после обрыва: пропущенное догоняется обычными запросами.
   * Первое подключение этого не делает — экраны и так только что загрузили данные.
   */
  onReconnected(): void
}

/** Та часть WebSocket, которой пользуется шина: тесты подставляют свою реализацию. */
export interface ChatSocket {
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  send(data: string): void
  close(): void
}

export type SocketFactory = (url: string) => ChatSocket

/**
 * Событие без `conversation_id` контрактом не предусмотрено — это мусор, как и неизвестный тип:
 * без id нечего обновлять, а шина не источник правды и данные всегда догоняются запросами.
 */
function isLetterEvent(message: unknown): message is LetterEvent {
  if (typeof message !== 'object' || message === null) return false
  const { type, letter_id, conversation_id } = message as Partial<
    Record<keyof LetterEvent, unknown>
  >
  return (
    EVENT_TYPES.some((known) => known === type) &&
    typeof letter_id === 'string' &&
    typeof conversation_id === 'string'
  )
}

function parseEvent(data: unknown): LetterEvent | null {
  if (typeof data !== 'string') return null
  try {
    const message: unknown = JSON.parse(data)
    return isLetterEvent(message) ? message : null
  } catch {
    return null
  }
}

/**
 * Подключение к realtime-шине на всё время жизни приложения. Возвращает функцию отключения.
 *
 * Сетевой обрыв — повтор с нарастающей паузой. Close 4401 — токен не принят: сокет просит
 * сессию обновить пару (как HTTP при 401) и пробует ещё раз; если и свежий токен отвергнут,
 * шина молчит до следующего входа, а приложение живёт на обычных запросах.
 */
export function connectChatEvents(
  handlers: ChatSocketHandlers,
  createSocket: SocketFactory = (url) => new WebSocket(url),
): () => void {
  let socket: ChatSocket | null = null
  let stopped = false
  let attempt = 0
  let openedBefore = false
  // Токен, выданный нашим же refresh: если сервер отверг и его, повторять бессмысленно.
  let refreshedToken: string | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null

  function release(current: ChatSocket) {
    current.onopen = null
    current.onmessage = null
    current.onclose = null
    if (pingTimer) clearInterval(pingTimer)
    pingTimer = null
    if (socket === current) socket = null
  }

  function scheduleRetry() {
    if (stopped) return
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt)
    attempt += 1
    retryTimer = setTimeout(() => {
      retryTimer = null
      open()
    }, delay)
  }

  async function renewToken(rejected: string | null) {
    const current = api.accessToken()
    // Пару уже обновил HTTP-запрос — достаточно переподключиться с новым токеном.
    if (current && current !== rejected) {
      open()
      return
    }
    if (rejected !== null && rejected === refreshedToken) return
    try {
      await api.refreshSession()
      refreshedToken = api.accessToken()
      open()
    } catch (error) {
      // Отказ сервера уже закрыл сессию; сеть и 5xx — обычный обрыв, пробуем позже.
      if (error instanceof ApiError && error.isSessionRejected) return
      scheduleRetry()
    }
  }

  function open() {
    if (stopped) return
    const token = api.accessToken()
    if (!token) {
      void renewToken(null)
      return
    }

    const current = createSocket(conversationsApi.eventsUrl(token))
    socket = current
    // Ответа на прошлый ping нет — соединение мертво, хотя браузер об этом ещё не знает.
    let awaitingPong = false

    current.onopen = () => {
      pingTimer = setInterval(() => {
        if (awaitingPong) {
          release(current)
          current.close()
          scheduleRetry()
          return
        }
        awaitingPong = true
        current.send('ping')
      }, PING_INTERVAL_MS)
      if (openedBefore) handlers.onReconnected()
      openedBefore = true
    }

    current.onmessage = (message: MessageEvent) => {
      // Пауза сбрасывается по живому ответу, а не по open: сервер принимает сокет и лишь
      // потом закрывает его, и сброс на open превратил бы такой отказ в частый цикл.
      attempt = 0
      awaitingPong = false
      const event = parseEvent(message.data)
      if (event) handlers.onEvent(event)
    }

    current.onclose = (event: CloseEvent) => {
      release(current)
      if (stopped) return
      if (event.code === SESSION_CLOSE_CODE) void renewToken(token)
      else scheduleRetry()
    }
  }

  open()

  return () => {
    stopped = true
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
    if (socket) {
      const current = socket
      release(current)
      current.close()
    }
  }
}
