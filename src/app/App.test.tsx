import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import i18n from '../shared/i18n'
import { meWithoutCity } from '../test/msw/handlers'
import { server } from '../test/msw/server'
import { renderAt } from '../test/render'
import { signInForTest, signOutForTest } from '../test/session'

describe('маршруты', () => {
  it('корень ведёт во входящие', async () => {
    await signInForTest()
    renderAt('/')
    expect(
      await screen.findByRole('heading', { name: i18n.t('inbox.title', { ns: 'letters' }) }),
    ).toBeInTheDocument()
  })

  it('неизвестный адрес показывает 404 внутри layout', async () => {
    await signInForTest()
    renderAt('/nothing-here')
    expect(
      await screen.findByRole('heading', { name: i18n.t('not_found', { ns: 'errors' }) }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: i18n.t('app.name') })).toBeInTheDocument()
  })

  it('пользователя без города уводит на выбор города', async () => {
    server.use(http.get('*/api/users/me', () => HttpResponse.json(meWithoutCity)))
    await signInForTest()
    renderAt('/inbox')
    expect(
      await screen.findByRole('heading', { name: i18n.t('title', { ns: 'city' }) }),
    ).toBeInTheDocument()
  })

  it('анонимного пользователя уводит на вход', async () => {
    signOutForTest()
    renderAt('/inbox')
    expect(
      await screen.findByRole('heading', { name: i18n.t('login.title', { ns: 'auth' }) }),
    ).toBeInTheDocument()
  })
})
