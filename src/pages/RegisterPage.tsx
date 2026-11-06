import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '../api/errors'
import { pathAfterAuth, useSession } from '../features/session'
import { errorMessage } from '../shared/i18n/apiError'
import { Button, Field } from '../shared/ui'
import styles from './auth.module.css'

type FieldCheck = 'emailRequired' | 'emailInvalid' | 'usernameFormat' | 'passwordLength'
type Validation = Partial<Record<'email' | 'username' | 'password', FieldCheck>>

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

export function RegisterPage() {
  const { t } = useTranslation('auth')
  const { register } = useSession()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [validation, setValidation] = useState<Validation>({})
  const [serverError, setServerError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(false)

  /** Занятые email и имя — ошибки про конкретное поле, остальные коды — про форму целиком. */
  const emailTaken = serverError?.code === 'email_taken'
  const usernameTaken = serverError?.code === 'username_taken'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedEmail = email.trim()

    const checks: Validation = {}
    if (!trimmedEmail) checks.email = 'emailRequired'
    else if (!EMAIL_PATTERN.test(trimmedEmail)) checks.email = 'emailInvalid'
    if (!USERNAME_PATTERN.test(username)) checks.username = 'usernameFormat'
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      checks.password = 'passwordLength'
    }

    setValidation(checks)
    setServerError(null)
    if (checks.email || checks.username || checks.password) return

    setPending(true)
    try {
      await register({ email: trimmedEmail, username, password })
      navigate(pathAfterAuth(location.state), { replace: true })
    } catch (error) {
      setServerError(error instanceof ApiError ? error : null)
      setValidation({})
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <h1>{t('register.title')}</h1>
      {serverError && !emailTaken && !usernameTaken ? (
        <p className={styles.alert} role="alert">
          {errorMessage(serverError)}
        </p>
      ) : null}
      <form className={styles.form} onSubmit={submit} noValidate>
        <Field
          label={t('register.email')}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          error={
            validation.email
              ? t(`validation.${validation.email}`)
              : emailTaken
                ? errorMessage(serverError)
                : undefined
          }
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label={t('register.username')}
          name="username"
          autoComplete="username"
          hint={t('register.usernameHint')}
          value={username}
          error={
            validation.username
              ? t(`validation.${validation.username}`)
              : usernameTaken
                ? errorMessage(serverError)
                : undefined
          }
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
        />
        <Field
          label={t('register.password')}
          type="password"
          name="password"
          autoComplete="new-password"
          hint={t('register.passwordHint')}
          value={password}
          error={validation.password ? t(`validation.${validation.password}`) : undefined}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button className={styles.submit} type="submit" disabled={pending}>
          {t('register.submit')}
        </Button>
      </form>
      <div className={styles.footer}>
        <Link to="/login">{t('register.toLogin')}</Link>
      </div>
    </section>
  )
}
