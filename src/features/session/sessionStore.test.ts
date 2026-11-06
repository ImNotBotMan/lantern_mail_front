import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api/errors'
import { usersApi } from '../../api/endpoints/users'
import { me, sessionRejected, tokens, unauthorized } from '../../test/msw/handlers'
import { server } from '../../test/msw/server'
import { reloadForTest, signInForTest } from '../../test/session'
import {
  bootstrapSession,
  getSessionSnapshot,
  login,
  logout,
  logoutAll,
  resetSessionForTests,
} from './sessionStore'
import { REFRESH_TOKEN_KEY, getAccessToken, getRefreshToken } from './tokens'

describe('bootstrap', () => {
  it('без refresh-токена сразу анонимный и не ходит в сеть', async () => {
    let refreshes = 0
    server.use(
      http.post('*/api/auth/refresh', () => {
        refreshes += 1
        return HttpResponse.json(tokens)
      }),
    )

    await bootstrapSession()

    expect(getSessionSnapshot()).toMatchObject({ status: 'anonymous', user: null })
    expect(refreshes).toBe(0)
  })

  it('с refresh-токеном поднимает сессию и профиль', async () => {
    await reloadForTest()

    expect(getSessionSnapshot()).toMatchObject({ status: 'authenticated', user: me })
    expect(getAccessToken()).toBe(tokens.access_token)
  })

  it('отказ refresh закрывает сессию и стирает пару', async () => {
    server.use(http.post('*/api/auth/refresh', () => sessionRejected()))

    await reloadForTest()

    expect(getSessionSnapshot().status).toBe('anonymous')
    expect(getRefreshToken()).toBeNull()
  })

  it('обрыв сети при bootstrap не разлогинивает: ошибка с возможностью повтора', async () => {
    server.use(http.post('*/api/auth/refresh', () => HttpResponse.error()))

    await reloadForTest()

    const snapshot = getSessionSnapshot()
    expect(snapshot.status).toBe('loading')
    expect(snapshot.error?.code).toBe('network_error')
    expect(getRefreshToken()).toBe(tokens.refresh_token)
  })

  it('два bootstrap подряд дают один refresh', async () => {
    resetSessionForTests()
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
    let refreshes = 0
    server.use(
      http.post('*/api/auth/refresh', () => {
        refreshes += 1
        return HttpResponse.json(tokens)
      }),
    )

    await Promise.all([bootstrapSession(), bootstrapSession()])

    expect(refreshes).toBe(1)
  })
})

describe('вход и выход', () => {
  it('вход сохраняет пару и подгружает профиль', async () => {
    await login('me@example.com', 'password123')

    expect(getSessionSnapshot()).toMatchObject({ status: 'authenticated', user: me })
    expect(getAccessToken()).toBe(tokens.access_token)
    expect(getRefreshToken()).toBe(tokens.refresh_token)
  })

  it('выход срабатывает локально, даже если /auth/logout не дошёл', async () => {
    await signInForTest()
    server.use(http.post('*/api/auth/logout', () => HttpResponse.error()))

    await logout()

    expect(getSessionSnapshot().status).toBe('anonymous')
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('выход на всех отзывает сессии и закрывает сессию', async () => {
    await signInForTest()

    await logoutAll()

    expect(getSessionSnapshot().status).toBe('anonymous')
    expect(getRefreshToken()).toBeNull()
  })

  it('выход на всех при ошибке сервера оставляет сессию открытой', async () => {
    await signInForTest()
    server.use(http.post('*/api/auth/logout-all', () => HttpResponse.error()))

    await expect(logoutAll()).rejects.toBeInstanceOf(ApiError)

    expect(getSessionSnapshot().status).toBe('authenticated')
    expect(getRefreshToken()).not.toBeNull()
  })
})

describe('связка с api-client', () => {
  it('отказ refresh на обычном запросе закрывает сессию', async () => {
    await signInForTest()
    server.use(
      http.get('*/api/users/me', () => unauthorized()),
      http.post('*/api/auth/refresh', () => sessionRejected()),
    )

    await expect(usersApi.me()).rejects.toMatchObject({ code: 'invalid_refresh_token' })

    expect(getSessionSnapshot().status).toBe('anonymous')
  })

  it('обрыв сети во время refresh оставляет сессию открытой', async () => {
    await signInForTest()
    server.use(
      http.get('*/api/users/me', () => unauthorized()),
      http.post('*/api/auth/refresh', () => HttpResponse.error()),
    )

    await expect(usersApi.me()).rejects.toMatchObject({ code: 'network_error' })

    expect(getSessionSnapshot().status).toBe('authenticated')
    expect(getRefreshToken()).toBe(tokens.refresh_token)
  })
})
