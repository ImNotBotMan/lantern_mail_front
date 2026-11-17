import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cityName } from '../features/city'
import i18n from '../shared/i18n'
import { GoogleSignInError, signInWithGoogle } from '../shared/firebase'
import {
  me,
  meWithoutCity,
  meWithoutUsername,
  moscow,
  petersburg,
  tokens,
} from '../test/msw/handlers'
import { server } from '../test/msw/server'
import { renderAt } from '../test/render'
import { signInForTest, signOutForTest } from '../test/session'
import { t } from '../test/i18n'

/** Конфиг Firebase — переменные окружения: без них кнопка Google не рендерится вовсе. */
function enableGoogle() {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key')
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com')
  vi.stubEnv('VITE_FIREBASE_APP_ID', 'test-app')
}

beforeEach(() => {
  enableGoogle()
  vi.mocked(signInWithGoogle).mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

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
        return HttpResponse.json(
          { email: 'new@example.com', verification_required: true },
          { status: 202 },
        )
      }),
    )
    renderAt('/register')

    await submitRegister('new@example.com', 'new_user', 'short')

    expect(screen.getByRole('alert')).toHaveTextContent(t('validation.passwordLength'))
    expect(calls).toBe(0)
  })

  it('успешная регистрация просит подтвердить почту, а не пускает внутрь', async () => {
    signOutForTest()
    renderAt('/register')

    await submitRegister('new@example.com', 'new_user', 'password123')

    expect(await screen.findByRole('heading', { name: t('verify.title') })).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t('verify.text', { ns: 'auth', email: 'new@example.com' })),
    ).toBeInTheDocument()
    // Без подтверждённого адреса сессии нет: экран входа, а не продукт
    expect(screen.queryByRole('heading', { name: t('login.title') })).toBeNull()
  })

  it('повторная отправка после подтверждения сразу входит', async () => {
    signOutForTest()
    server.use(http.get('*/api/users/me', () => HttpResponse.json(meWithoutCity)))
    renderAt('/register')
    await submitRegister('new@example.com', 'new_user', 'password123')

    // Адрес подтвердили: повтор входа (он же повтор письма) проходит и ведёт к городу
    await userEvent.click(await screen.findByRole('button', { name: t('verify.resend') }))

    expect(await screen.findByRole('heading', { name: t('title', 'city') })).toBeInTheDocument()
  })
})

describe('подтверждение почты при входе', () => {
  it('неподтверждённый адрес ведёт на экран письма, а не к ошибке', async () => {
    signOutForTest()
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { error: 'email_not_verified', message: 'Confirm your email' },
          { status: 403 },
        ),
      ),
    )
    renderAt('/login')

    await submitLogin('me@example.com', 'password123')

    expect(await screen.findByRole('heading', { name: t('verify.title') })).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t('verify.text', { ns: 'auth', email: 'me@example.com' })),
    ).toBeInTheDocument()
  })

  it('после подтверждения повтор входа пускает в продукт', async () => {
    signOutForTest()
    renderAt('/login')
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { error: 'email_not_verified', message: 'Confirm your email' },
          { status: 403 },
        ),
      ),
    )
    await submitLogin('me@example.com', 'password123')
    await screen.findByRole('heading', { name: t('verify.title') })

    // Адрес подтверждён: тот же повтор входа теперь выдаёт пару токенов
    server.use(http.post('*/api/auth/login', () => HttpResponse.json(tokens)))
    await userEvent.click(screen.getByRole('button', { name: t('verify.resend') }))

    expect(
      await screen.findByRole('heading', { name: t('inbox.title', 'letters') }),
    ).toBeInTheDocument()
  })
})

describe('вход через Google', () => {
  async function clickGoogle() {
    await userEvent.click(await screen.findByRole('button', { name: t('login.google') }))
  }

  it('меняет ID-токен Firebase на нашу сессию', async () => {
    signOutForTest()
    vi.mocked(signInWithGoogle).mockResolvedValue('firebase-id-token')
    let sentToken = ''
    server.use(
      http.post('*/api/auth/firebase', async ({ request }) => {
        sentToken = ((await request.json()) as { id_token: string }).id_token
        return HttpResponse.json(tokens)
      }),
    )
    renderAt('/login')

    await clickGoogle()

    expect(
      await screen.findByRole('heading', { name: t('inbox.title', 'letters') }),
    ).toBeInTheDocument()
    expect(sentToken).toBe('firebase-id-token')
  })

  it('новому пользователю сначала предлагает выбрать имя', async () => {
    signOutForTest()
    vi.mocked(signInWithGoogle).mockResolvedValue('firebase-id-token')
    server.use(http.get('*/api/users/me', () => HttpResponse.json(meWithoutUsername)))
    renderAt('/login')

    await clickGoogle()

    expect(
      await screen.findByRole('heading', { name: t('chooseUsername.title') }),
    ).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(t('register.username')), 'lantern')
    await userEvent.click(screen.getByRole('button', { name: t('chooseUsername.submit') }))

    // Имя сохранено — дальше обычный путь: город уже есть, значит входящие
    expect(
      await screen.findByRole('heading', { name: t('inbox.title', 'letters') }),
    ).toBeInTheDocument()
  })

  it('закрытое окно Google ничего не показывает', async () => {
    signOutForTest()
    vi.mocked(signInWithGoogle).mockRejectedValue(new GoogleSignInError('cancelled'))
    renderAt('/login')

    await clickGoogle()

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('heading', { name: t('login.title') })).toBeInTheDocument()
  })

  it('занятый адрес объясняется подсказкой сервера', async () => {
    signOutForTest()
    vi.mocked(signInWithGoogle).mockResolvedValue('firebase-id-token')
    server.use(
      http.post('*/api/auth/firebase', () =>
        HttpResponse.json(
          { error: 'email_registered', message: 'Account exists' },
          { status: 409 },
        ),
      ),
    )
    renderAt('/login')

    await clickGoogle()

    expect(await screen.findByRole('alert')).toHaveTextContent(t('email_registered', 'errors'))
  })
})

describe('сброс пароля', () => {
  it('просит только email и не раскрывает, есть ли аккаунт', async () => {
    signOutForTest()
    let sent = ''
    server.use(
      http.post('*/api/auth/password/reset', async ({ request }) => {
        sent = ((await request.json()) as { email: string }).email
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderAt('/login')

    await userEvent.click(await screen.findByRole('button', { name: t('login.forgot') }))
    await userEvent.type(screen.getByLabelText(t('login.email')), 'ghost@example.com')
    await userEvent.click(screen.getByRole('button', { name: t('reset.submit') }))

    expect(await screen.findByText(t('reset.sent'))).toBeInTheDocument()
    expect(sent).toBe('ghost@example.com')
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
