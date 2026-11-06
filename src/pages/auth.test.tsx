import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { tokens } from '../test/msw/handlers'
import { server } from '../test/msw/server'
import { renderAt } from '../test/render'
import { signInForTest, signOutForTest } from '../test/session'
import { t } from '../test/i18n'

async function submitLogin(email: string, password: string) {
  await userEvent.type(await screen.findByLabelText(t('login.email')), email)
  await userEvent.type(screen.getByLabelText(t('login.password')), password)
  await userEvent.click(screen.getByRole('button', { name: t('login.submit') }))
}

async function submitRegister(email: string, username: string, password: string) {
  await userEvent.type(await screen.findByLabelText(t('register.email')), email)
  await userEvent.type(screen.getByLabelText(t('register.username')), username)
  await userEvent.type(screen.getByLabelText(t('register.password')), password)
  await userEvent.click(screen.getByRole('button', { name: t('register.submit') }))
}

describe('вход', () => {
  it('неверная пара показывается под паролем', async () => {
    signOutForTest()
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { error: 'invalid_credentials', message: 'Invalid credentials' },
          { status: 401 },
        ),
      ),
    )
    renderAt('/login')

    await submitLogin('me@example.com', 'wrong-password')

    expect(await screen.findByRole('alert')).toHaveTextContent(t('invalid_credentials', 'errors'))
    expect(screen.getByRole('heading', { name: t('login.title') })).toBeInTheDocument()
  })

  it('обрыв сети показывается ошибкой формы, а не поля', async () => {
    signOutForTest()
    server.use(http.post('*/api/auth/login', () => HttpResponse.error()))
    renderAt('/login')

    await submitLogin('me@example.com', 'password123')

    expect(await screen.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))
    expect(screen.getByLabelText(t('login.password'))).not.toHaveAttribute('aria-invalid')
  })

  it('пустые поля не отправляются на сервер', async () => {
    signOutForTest()
    let calls = 0
    server.use(
      http.post('*/api/auth/login', () => {
        calls += 1
        return HttpResponse.json(tokens)
      }),
    )
    renderAt('/login')

    await userEvent.click(await screen.findByRole('button', { name: t('login.submit') }))

    expect(screen.getByText(t('validation.emailRequired'))).toBeInTheDocument()
    expect(screen.getByText(t('validation.passwordRequired'))).toBeInTheDocument()
    expect(calls).toBe(0)
  })
})

describe('регистрация', () => {
  it('занятый email показывается под полем email', async () => {
    signOutForTest()
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json(
          { error: 'email_taken', message: 'Email is already taken' },
          { status: 409 },
        ),
      ),
    )
    renderAt('/register')

    await submitRegister('taken@example.com', 'new_user', 'password123')

    expect(await screen.findByRole('alert')).toHaveTextContent(t('email_taken', 'errors'))
  })

  it('слишком короткий пароль не уходит на сервер', async () => {
    signOutForTest()
    let calls = 0
    server.use(
      http.post('*/api/auth/register', () => {
        calls += 1
        return HttpResponse.json(tokens, { status: 201 })
      }),
    )
    renderAt('/register')

    await submitRegister('new@example.com', 'new_user', 'short')

    expect(screen.getByRole('alert')).toHaveTextContent(t('validation.passwordLength'))
    expect(calls).toBe(0)
  })

  it('успешная регистрация сразу ведёт внутрь', async () => {
    signOutForTest()
    renderAt('/register')

    await submitRegister('new@example.com', 'new_user', 'password123')

    expect(
      await screen.findByRole('heading', { name: t('inbox.title', 'letters') }),
    ).toBeInTheDocument()
  })
})

describe('аккаунт', () => {
  it('показывает пользователя и выходит на этом устройстве', async () => {
    await signInForTest()
    renderAt('/account')

    expect(await screen.findByRole('heading', { name: t('account.title') })).toBeInTheDocument()
    expect(screen.getByText('me_user')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: t('account.logout') }))

    expect(
      await screen.findByRole('heading', { name: t('login.title') }),
    ).toBeInTheDocument()
  })

  it('выход на всех требует подтверждения и закрывает сессию', async () => {
    await signInForTest()
    renderAt('/account')

    await userEvent.click(await screen.findByRole('button', { name: t('account.logoutAll') }))
    expect(screen.getByText(t('account.logoutAllQuestion'))).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: t('account.logoutAllConfirm') }))

    expect(
      await screen.findByRole('heading', { name: t('login.title') }),
    ).toBeInTheDocument()
  })

  it('отмена подтверждения оставляет сессию', async () => {
    await signInForTest()
    renderAt('/account')

    await userEvent.click(await screen.findByRole('button', { name: t('account.logoutAll') }))
    await userEvent.click(screen.getByRole('button', { name: t('actions.cancel', 'common') }))

    expect(screen.queryByText(t('account.logoutAllQuestion'))).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: t('account.title') })).toBeInTheDocument()
  })

  it('ошибка выхода на всех оставляет пользователя внутри', async () => {
    await signInForTest()
    server.use(http.post('*/api/auth/logout-all', () => HttpResponse.error()))
    renderAt('/account')

    await userEvent.click(await screen.findByRole('button', { name: t('account.logoutAll') }))
    await userEvent.click(screen.getByRole('button', { name: t('account.logoutAllConfirm') }))

    expect(await screen.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))
    expect(screen.getByRole('heading', { name: t('account.title') })).toBeInTheDocument()
  })
})
