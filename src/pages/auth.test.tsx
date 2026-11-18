import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { cityName } from '../features/city'
import i18n from '../shared/i18n'
import { me, moscow, petersburg, tokens } from '../test/msw/handlers'
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

/** Ровно то, что нужно форме; подходит и прямой API userEvent, и экземпляр с поддельными таймерами. */
interface FormActor {
  type(element: Element, text: string): Promise<void>
  click(element: Element): Promise<void>
}

async function submitReset(email: string, actor: FormActor = userEvent) {
  await actor.type(await screen.findByLabelText(t('forgot.email')), email)
  await actor.click(screen.getByRole('button', { name: t('forgot.submit') }))
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

  it('сессию не открывает и показывает подтверждение почты', async () => {
    signOutForTest()
    let meCalls = 0
    server.use(
      http.get('*/api/users/me', () => {
        meCalls += 1
        return HttpResponse.json(me)
      }),
    )
    renderAt('/register')

    await submitRegister('new@example.com', 'new_user', 'password123')

    expect(
      await screen.findByRole('heading', { name: t('register.sentTitle') }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(t('register.sentBody').replace('{{email}}', 'new@example.com')),
    ).toBeInTheDocument()
    expect(meCalls).toBe(0)
  })

  it('неподтверждённый email показывается на входе', async () => {
    signOutForTest()
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { error: 'email_not_verified', message: 'Confirm your email before signing in' },
          { status: 403 },
        ),
      ),
    )
    renderAt('/login')

    await submitLogin('new@example.com', 'password123')

    expect(await screen.findByRole('alert')).toHaveTextContent(t('email_not_verified', 'errors'))
    expect(screen.getByRole('heading', { name: t('login.title') })).toBeInTheDocument()
  })
})

describe('восстановление пароля', () => {
  it('ссылка со входа ведёт на страницу восстановления', async () => {
    signOutForTest()
    renderAt('/login')

    await userEvent.click(await screen.findByRole('link', { name: t('login.forgot') }))

    expect(await screen.findByRole('heading', { name: t('forgot.title') })).toBeInTheDocument()
  })

  it('пустой и невалидный email не уходят на сервер', async () => {
    signOutForTest()
    let calls = 0
    server.use(
      http.post('*/api/auth/password/reset', () => {
        calls += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderAt('/forgot-password')

    await userEvent.click(await screen.findByRole('button', { name: t('forgot.submit') }))
    expect(screen.getByText(t('validation.emailRequired'))).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(t('forgot.email')), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: t('forgot.submit') }))
    expect(screen.getByText(t('validation.emailInvalid'))).toBeInTheDocument()

    expect(calls).toBe(0)
  })

  it('после 204 показывает нейтральное подтверждение с адресом', async () => {
    signOutForTest()
    renderAt('/forgot-password')

    await submitReset('nobody@example.com')

    expect(await screen.findByRole('heading', { name: t('forgot.sentTitle') })).toBeInTheDocument()
    expect(
      screen.getByText(t('forgot.sentBody').replace('{{email}}', 'nobody@example.com')),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(t('forgot.email'))).not.toBeInTheDocument()
  })

  it('502 показывает ошибку и не выдаёт письмо за отправленное', async () => {
    signOutForTest()
    server.use(
      http.post('*/api/auth/password/reset', () =>
        HttpResponse.json(
          {
            error: 'identity_unavailable',
            message: 'Identity provider is temporarily unavailable',
          },
          { status: 502 },
        ),
      ),
    )
    renderAt('/forgot-password')

    await submitReset('me@example.com')

    expect(await screen.findByRole('alert')).toHaveTextContent(t('identity_unavailable', 'errors'))
    expect(screen.queryByRole('heading', { name: t('forgot.sentTitle') })).not.toBeInTheDocument()
    expect(screen.getByLabelText(t('forgot.email'))).toBeInTheDocument()
  })

  it('повторная отправка ждёт минуту и не уводит с подтверждения', async () => {
    signOutForTest()
    // Только отсчёт cooldown и часы: setTimeout оставляем настоящим, иначе не отвечает MSW.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    try {
      const actor = userEvent.setup()
      let calls = 0
      server.use(
        http.post('*/api/auth/password/reset', () => {
          calls += 1
          return new HttpResponse(null, { status: 204 })
        }),
      )
      renderAt('/forgot-password')

      await submitReset('me@example.com', actor)
      expect(
        await screen.findByRole('heading', { name: t('forgot.sentTitle') }),
      ).toBeInTheDocument()
      expect(calls).toBe(1)

      const [before, after] = t('forgot.retryIn').split('{{seconds}}')
      expect(screen.getByText(new RegExp(`${before}\\d+${after}`))).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: t('forgot.retry') })).not.toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(60_000)
      })

      const retry = screen.getByRole('button', { name: t('forgot.retry') })
      await actor.click(retry)

      expect(
        await screen.findByRole('heading', { name: t('forgot.sentTitle') }),
      ).toBeInTheDocument()
      expect(calls).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('аккаунт', () => {
  it('показывает пользователя и выходит на этом устройстве', async () => {
    await signInForTest()
    renderAt('/account')

    expect(await screen.findByRole('heading', { name: t('account.title') })).toBeInTheDocument()
    expect(screen.getByText('me_user')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: t('account.logout') }))

    expect(await screen.findByRole('heading', { name: t('login.title') })).toBeInTheDocument()
  })

  it('выход на всех требует подтверждения и закрывает сессию', async () => {
    await signInForTest()
    renderAt('/account')

    await userEvent.click(await screen.findByRole('button', { name: t('account.logoutAll') }))
    expect(screen.getByText(t('account.logoutAllQuestion'))).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: t('account.logoutAllConfirm') }))

    expect(await screen.findByRole('heading', { name: t('login.title') })).toBeInTheDocument()
  })

  it('отмена подтверждения оставляет сессию', async () => {
    await signInForTest()
    renderAt('/account')

    await userEvent.click(await screen.findByRole('button', { name: t('account.logoutAll') }))
    await userEvent.click(screen.getByRole('button', { name: t('actions.cancel', 'common') }))

    expect(screen.queryByText(t('account.logoutAllQuestion'))).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: t('account.title') })).toBeInTheDocument()
  })

  it('показывает город профиля и меняет его', async () => {
    // Город выбран давно, поэтому недельный лимит смены уже истёк
    server.use(
      http.get('*/api/users/me', () =>
        HttpResponse.json({ ...me, city_changed_at: '2020-01-01T12:00:00Z' }),
      ),
    )
    await signInForTest()
    renderAt('/account')

    expect(await screen.findByText(cityName(moscow, i18n.language))).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: t('change', 'city') }))
    await userEvent.click(
      await screen.findByRole('radio', { name: new RegExp(cityName(petersburg, i18n.language)) }),
    )
    await userEvent.click(screen.getByRole('button', { name: t('submit', 'city') }))

    expect(await screen.findByText(cityName(petersburg, i18n.language))).toBeInTheDocument()
  })

  it('в недельный лимит показывает дату смены вместо кнопки', async () => {
    server.use(
      http.get('*/api/users/me', () =>
        HttpResponse.json({ ...me, city_changed_at: new Date().toISOString() }),
      ),
    )
    await signInForTest()
    renderAt('/account')

    const limit = t('changeLimit', 'city').replace('{{date}}', '')
    expect(await screen.findByText(new RegExp(limit))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('change', 'city') })).toBeNull()
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
