import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { ApiClient, api } from './client'
import type { SessionBridge } from './client'
import { authApi } from './endpoints/auth'
import { usersApi } from './endpoints/users'
import { ApiError } from './errors'
import { sessionRejected, unauthorized } from '../test/msw/handlers'
import { server } from '../test/msw/server'

const ME = { id: 1, username: 'me_user', created_at: '2026-01-01T12:00:00Z' }

interface SessionStubs {
  getAccessToken?: () => string | null
  refresh?: () => Promise<void>
  onSessionRejected?: () => void
}

function makeSession(stubs: SessionStubs = {}) {
  return {
    getAccessToken: vi.fn(stubs.getAccessToken ?? (() => 'access-1')),
    refresh: vi.fn(stubs.refresh ?? (async () => undefined)),
    onSessionRejected: vi.fn(stubs.onSessionRejected ?? (() => undefined)),
  }
}

function makeClient(session: SessionBridge) {
  const client = new ApiClient()
  client.setSession(session)
  return client
}

describe('api-client', () => {
  it('прикрепляет access-токен', async () => {
    const client = makeClient(makeSession())
    let authorization: string | null = null

    server.use(
      http.get('*/api/users/me', ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json(ME)
      }),
    )

    await client.request('GET', '/users/me')
    expect(authorization).toBe('Bearer access-1')
  })

  it('на 401 обновляет пару и повторяет запрос один раз', async () => {
    let token = 'stale'
    const session = makeSession({ getAccessToken: () => token })
    const client = makeClient(session)
    let calls = 0

    session.refresh.mockImplementation(async () => {
      token = 'fresh'
    })

    server.use(
      http.get('*/api/users/me', ({ request }) => {
        calls += 1
        return request.headers.get('Authorization') === 'Bearer fresh'
          ? HttpResponse.json(ME)
          : unauthorized()
      }),
    )

    const user = await client.request<{ username: string }>('GET', '/users/me')
    expect(user.username).toBe('me_user')
    expect(session.refresh).toHaveBeenCalledTimes(1)
    expect(calls).toBe(2)
    expect(session.onSessionRejected).not.toHaveBeenCalled()
  })

  it('два параллельных 401 дают один refresh', async () => {
    let fresh = false
    const session = makeSession({ getAccessToken: () => (fresh ? 'fresh' : 'stale') })
    const client = makeClient(session)

    session.refresh.mockImplementation(async () => {
      fresh = true
    })

    server.use(
      http.get('*/api/users/me', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh' ? HttpResponse.json(ME) : unauthorized(),
      ),
      http.get('*/api/letters/sent', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh' ? HttpResponse.json([]) : unauthorized(),
      ),
    )

    await Promise.all([client.request('GET', '/users/me'), client.request('GET', '/letters/sent')])
    expect(session.refresh).toHaveBeenCalledTimes(1)
  })

  it('отказ refresh закрывает сессию', async () => {
    const session = makeSession({
      refresh: async () => {
        throw new ApiError(401, 'invalid_refresh_token', 'Invalid refresh token')
      },
    })
    const client = makeClient(session)

    server.use(
      http.get('*/api/users/me', () => unauthorized()),
      http.post('*/api/auth/refresh', () => sessionRejected()),
    )

    await expect(client.request('GET', '/users/me')).rejects.toBeInstanceOf(ApiError)
    expect(session.onSessionRejected).toHaveBeenCalledTimes(1)
  })

  it('обрыв сети во время refresh не закрывает сессию и не повторяет запрос', async () => {
    const session = makeSession({
      refresh: async () => {
        throw new ApiError(0, 'network_error', 'Failed to fetch')
      },
    })
    const client = makeClient(session)
    let calls = 0

    server.use(
      http.get('*/api/users/me', () => {
        calls += 1
        return unauthorized()
      }),
    )

    await expect(client.request('GET', '/users/me')).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    })
    expect(calls).toBe(1)
    expect(session.onSessionRejected).not.toHaveBeenCalled()
  })

  it('обрыв сети — ApiError network_error, сессия не закрывается', async () => {
    const session = makeSession()
    const client = makeClient(session)

    server.use(http.get('*/api/users/me', () => HttpResponse.error()))

    await expect(client.request('GET', '/users/me')).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    })
    expect(session.onSessionRejected).not.toHaveBeenCalled()
  })

  it('тело ошибки превращается в код и сообщение', async () => {
    const client = makeClient(makeSession())

    server.use(
      http.post('*/api/letters/:id/send', () =>
        HttpResponse.json({ error: 'not_friends', message: 'Not a friend' }, { status: 409 }),
      ),
    )

    await expect(client.request('POST', '/letters/123/send')).rejects.toMatchObject({
      status: 409,
      code: 'not_friends',
      message: 'Not a friend',
    })
  })

  it('логин отправляется формой и не запускает refresh', async () => {
    const session = makeSession()
    const client = makeClient(session)
    let contentType: string | null = null
    let body = ''

    server.use(
      http.post('*/api/auth/login', async ({ request }) => {
        contentType = request.headers.get('Content-Type')
        body = await request.text()
        return HttpResponse.json({
          access_token: 'a',
          refresh_token: 'r',
          token_type: 'bearer',
          expires_in: 900,
        })
      }),
    )

    const tokens = await client.request<{ access_token: string }>('POST', '/auth/login', {
      form: { username: 'alice@example.com', password: 'secret123' },
      isAuthRequest: true,
    })

    expect(tokens.access_token).toBe('a')
    expect(contentType).toContain('application/x-www-form-urlencoded')
    expect(body).toBe('username=alice%40example.com&password=secret123')
    expect(session.refresh).not.toHaveBeenCalled()
  })
})

describe('эндпоинты', () => {
  it('поиск кодирует запрос и отдаёт статус связи', async () => {
    api.setSession(makeSession())
    const results = await usersApi.search('ann a')
    expect(results[0]?.relationship).toBe('none')
  })

  it('authApi.login работает без сессии', async () => {
    const tokens = await authApi.login('alice@example.com', 'secret123')
    expect(tokens.refresh_token).toBe('refresh-1')
  })
})
