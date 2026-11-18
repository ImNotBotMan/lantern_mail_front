import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api } from '../../api'
import type { LetterEvent } from '../../api'
import { PING_INTERVAL_MS, RETRY_BASE_MS, SESSION_CLOSE_CODE, connectChatEvents } from './ws'
import type { ChatSocket } from './ws'

class FakeSocket implements ChatSocket {
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  readonly url: string
  readonly sent: string[] = []
  closed = false

  constructor(url: string) {
    this.url = url
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
  }

  accept() {
    this.onopen?.(new Event('open'))
  }

  receive(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }

  drop(code = 1006) {
    this.onclose?.(new CloseEvent('close', { code }))
  }
}

const event: LetterEvent = {
  type: 'letter.delivered',
  letter_id: '55555555-5555-5555-5555-555555555555',
  conversation_id: 'aaaaaaaa-0000-0000-0000-000000000001',
  sender_id: 2,
  recipient_id: 1,
  at: '2026-01-05T12:00:00Z',
}

let token: string | null
let sockets: FakeSocket[]

function connect() {
  const handlers = { onEvent: vi.fn(), onReconnected: vi.fn() }
  const disconnect = connectChatEvents(handlers, (url) => {
    const socket = new FakeSocket(url)
    sockets.push(socket)
    return socket
  })
  return { handlers, disconnect }
}

function last(): FakeSocket {
  const socket = sockets.at(-1)
  if (!socket) throw new Error('сокет не создан')
  return socket
}

/** Даёт отработать промисам refresh, не двигая часы. */
async function settle() {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve()
}

beforeEach(() => {
  vi.useFakeTimers()
  token = 'access-1'
  sockets = []
  vi.spyOn(api, 'accessToken').mockImplementation(() => token)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('realtime-шина', () => {
  it('подключается с access-токеном и держит соединение ping-ом', () => {
    const { handlers, disconnect } = connect()

    expect(new URL(last().url).pathname).toBe('/api/ws')
    expect(new URL(last().url).searchParams.get('token')).toBe('access-1')
    expect(last().url.startsWith('ws://')).toBe(true)

    last().accept()
    expect(handlers.onReconnected).not.toHaveBeenCalled()

    vi.advanceTimersByTime(PING_INTERVAL_MS)
    expect(last().sent).toEqual(['ping'])
    last().receive(JSON.stringify({ type: 'pong' }))
    vi.advanceTimersByTime(PING_INTERVAL_MS)
    expect(last().sent).toEqual(['ping', 'ping'])

    disconnect()
  })

  it('передаёт события писем и молча пропускает pong и мусор', () => {
    const { handlers, disconnect } = connect()
    last().accept()

    last().receive(JSON.stringify({ type: 'pong' }))
    last().receive('не json')
    last().receive(JSON.stringify({ type: 'friend.added', letter_id: 'x' }))
    // Контракт: id диалога есть у всех трёх событий — без него обновлять нечего
    last().receive(JSON.stringify({ ...event, conversation_id: undefined }))
    last().receive(JSON.stringify(event))
    last().receive(JSON.stringify(event))

    expect(handlers.onEvent).toHaveBeenCalledTimes(2)
    expect(handlers.onEvent).toHaveBeenCalledWith(event)
    disconnect()
  })

  it('после сетевого обрыва переподключается с нарастающей паузой', () => {
    const { handlers, disconnect } = connect()
    last().accept()
    last().drop()

    vi.advanceTimersByTime(RETRY_BASE_MS - 1)
    expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(2)

    last().drop()
    vi.advanceTimersByTime(RETRY_BASE_MS)
    expect(sockets).toHaveLength(2)
    vi.advanceTimersByTime(RETRY_BASE_MS)
    expect(sockets).toHaveLength(3)

    // Переподключение догоняет пропущенное обычными запросами.
    last().accept()
    expect(handlers.onReconnected).toHaveBeenCalledTimes(1)
    disconnect()
  })

  it('молчащее соединение без pong считается мёртвым и пересоздаётся', () => {
    const { disconnect } = connect()
    const first = last()
    first.accept()

    vi.advanceTimersByTime(PING_INTERVAL_MS * 2)
    expect(first.closed).toBe(true)

    vi.advanceTimersByTime(RETRY_BASE_MS)
    expect(sockets).toHaveLength(2)
    disconnect()
  })

  it('close 4401 обновляет пару и переподключается с новым токеном', async () => {
    const refresh = vi.spyOn(api, 'refreshSession').mockImplementation(async () => {
      token = 'access-2'
    })
    const { disconnect } = connect()

    last().accept()
    last().drop(SESSION_CLOSE_CODE)
    await settle()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(sockets).toHaveLength(2)
    expect(new URL(last().url).searchParams.get('token')).toBe('access-2')
    disconnect()
  })

  it('если отвергнут и свежий токен, больше не переподключается', async () => {
    const refresh = vi.spyOn(api, 'refreshSession').mockImplementation(async () => {
      token = 'access-2'
    })
    const { disconnect } = connect()

    last().drop(SESSION_CLOSE_CODE)
    await settle()
    last().drop(SESSION_CLOSE_CODE)
    await settle()
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(sockets).toHaveLength(2)
    disconnect()
  })

  it('если пару уже обновил HTTP-запрос, переподключается без своего refresh', async () => {
    const refresh = vi.spyOn(api, 'refreshSession')
    const { disconnect } = connect()

    token = 'access-2'
    last().drop(SESSION_CLOSE_CODE)
    await settle()

    expect(refresh).not.toHaveBeenCalled()
    expect(new URL(last().url).searchParams.get('token')).toBe('access-2')
    disconnect()
  })

  it('отказ сервера в refresh — сессия закрыта, шина не ретраит', async () => {
    vi.spyOn(api, 'refreshSession').mockRejectedValue(
      new ApiError(401, 'invalid_refresh_token', 'Invalid refresh token'),
    )
    const { disconnect } = connect()

    last().drop(SESSION_CLOSE_CODE)
    await settle()
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(sockets).toHaveLength(1)
    disconnect()
  })

  it('обрыв сети во время refresh — обычный повтор с паузой', async () => {
    vi.spyOn(api, 'refreshSession').mockRejectedValueOnce(
      new ApiError(0, 'network_error', 'Network request failed'),
    )
    const { disconnect } = connect()

    last().drop(SESSION_CLOSE_CODE)
    await settle()
    expect(sockets).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS)
    expect(sockets).toHaveLength(2)
    disconnect()
  })

  it('отключение закрывает сокет и отменяет повторы', () => {
    const { disconnect } = connect()
    const first = last()
    first.drop()

    disconnect()
    vi.advanceTimersByTime(10 * 60_000)

    expect(sockets).toHaveLength(1)

    const { disconnect: again } = connect()
    const second = last()
    again()
    expect(second.closed).toBe(true)
  })
})
