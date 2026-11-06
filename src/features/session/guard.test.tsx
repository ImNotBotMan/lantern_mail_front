import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import i18n from '../../shared/i18n'
import { tokens } from '../../test/msw/handlers'
import { server } from '../../test/msw/server'
import { renderAt } from '../../test/render'
import { signInForTest, signOutForTest } from '../../test/session'
import { REFRESH_TOKEN_KEY } from './tokens'
import { t } from '../../test/i18n'

describe('RequireAuth', () => {
  it('возвращает на запрошенный адрес после входа', async () => {
    signOutForTest()
    renderAt('/friends')

    await userEvent.type(await screen.findByLabelText(t('login.email')), 'me@example.com')
    await userEvent.type(screen.getByLabelText(t('login.password')), 'password123')
    await userEvent.click(screen.getByRole('button', { name: t('login.submit') }))

    expect(
      await screen.findByRole('heading', { name: i18n.t('title', { ns: 'friends' }) }),
    ).toBeInTheDocument()
  })

  it('без сохранённого адреса ведёт во входящие', async () => {
    signOutForTest()
    renderAt('/login')

    await userEvent.type(await screen.findByLabelText(t('login.email')), 'me@example.com')
    await userEvent.type(screen.getByLabelText(t('login.password')), 'password123')
    await userEvent.click(screen.getByRole('button', { name: t('login.submit') }))

    expect(
      await screen.findByRole('heading', { name: i18n.t('inbox.title', { ns: 'letters' }) }),
    ).toBeInTheDocument()
  })

  it('на ошибке проверки сессии показывает повтор, а не форму входа', async () => {
    server.use(http.post('*/api/auth/refresh', () => HttpResponse.error()))
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
    renderAt('/login')

    expect(await screen.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))
    expect(screen.queryByLabelText(t('login.email'))).not.toBeInTheDocument()

    server.use(http.post('*/api/auth/refresh', () => HttpResponse.json(tokens)))
    await userEvent.click(screen.getByRole('button', { name: i18n.t('actions.retry') }))

    expect(
      await screen.findByRole('heading', { name: i18n.t('inbox.title', { ns: 'letters' }) }),
    ).toBeInTheDocument()
  })
})

describe('GuestOnly', () => {
  it('авторизованного уводит со страницы входа', async () => {
    await signInForTest()
    renderAt('/login')

    expect(
      await screen.findByRole('heading', { name: i18n.t('inbox.title', { ns: 'letters' }) }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(t('login.email'))).not.toBeInTheDocument()
  })
})
