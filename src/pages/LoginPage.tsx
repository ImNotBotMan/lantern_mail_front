import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '../api/errors'
import { pathAfterAuth, useSession } from '../features/session'
import { errorMessage } from '../shared/i18n/apiError'
import { Button, Field } from '../shared/ui'
import styles from './auth.module.css'

type FieldCheck = 'emailRequired' | 'emailInvalid' | 'passwordRequired'
type Validation = Partial<Record<'email' | 'password', FieldCheck>>

export function LoginPage() {
  const { t } = useTranslation('auth')
  const { login } = useSession()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [validation, setValidation] = useState<Validation>({})
  const [serverError, setServerError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(false)

  /** `invalid_credentials` — ошибка про введённые данные, поэтому живёт под паролем. */
  const credentialsRejected = serverError?.code === 'invalid_credentials'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedEmail = email.trim()

    const checks: Validation = {}
    if (!trimmedEmail) checks.email = 'emailRequired'
    else if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) checks.email = 'emailInvalid'
    if (!password) checks.password = 'passwordRequired'

    setValidation(checks)
    setServerError(null)
    if (checks.email || checks.password) return

    setPending(true)
    try {
      await login(trimmedEmail, password)
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
      <h1>{t('login.title')}</h1>
      {serverError && !credentialsRejected ? (
        <p className={styles.alert} role="alert">
          {errorMessage(serverError)}
        </p>
      ) : null}
      <form className={styles.form} onSubmit={submit} noValidate>
        <Field
          label={t('login.email')}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          error={validation.email ? t(`validation.${validation.email}`) : undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label={t('login.password')}
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          error={
            validation.password
              ? t(`validation.${validation.password}`)
              : credentialsRejected
                ? errorMessage(serverError)
                : undefined
          }
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button className={styles.submit} type="submit" disabled={pending}>
          {t('login.submit')}
        </Button>
      </form>
      <div className={styles.footer}>
        <Link to="/register">{t('login.toRegister')}</Link>
      </div>
    </section>
  )
}
