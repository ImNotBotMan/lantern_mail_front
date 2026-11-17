import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '../api/errors'
import {
  GoogleSignInButton,
  pathAfterAuth,
  useSession,
  VerifyEmailNotice,
} from '../features/session'
import { errorMessage } from '../shared/i18n/apiError'
import { Button, Field } from '../shared/ui'
import styles from './auth.module.css'

type FieldCheck = 'emailRequired' | 'emailInvalid' | 'passwordRequired'
type Validation = Partial<Record<'email' | 'password', FieldCheck>>

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

export function LoginPage() {
  const { t } = useTranslation('auth')
  const { login, requestPasswordReset, resendVerification } = useSession()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [validation, setValidation] = useState<Validation>({})
  const [serverError, setServerError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(false)

  /** Адрес, на который ушло письмо: экран входа сменяется на «проверьте почту». */
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)

  /** Сброс пароля — тот же экран, другая форма: письмо и страницу смены отдаёт Firebase. */
  const [resetting, setResetting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetPending, setResetPending] = useState(false)
  const [resetError, setResetError] = useState<ApiError | null>(null)

  /** `invalid_credentials` — ошибка про введённые данные, поэтому живёт под паролем. */
  const credentialsRejected = serverError?.code === 'invalid_credentials'

  if (verificationEmail) {
    return (
      <VerifyEmailNotice
        email={verificationEmail}
        onResend={() => resendVerification(verificationEmail, password)}
        onVerified={() => navigate(pathAfterAuth(location.state), { replace: true })}
      />
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedEmail = email.trim()

    const checks: Validation = {}
    if (!trimmedEmail) checks.email = 'emailRequired'
    else if (!EMAIL_PATTERN.test(trimmedEmail)) checks.email = 'emailInvalid'
    if (!password) checks.password = 'passwordRequired'

    setValidation(checks)
    setServerError(null)
    if (checks.email || checks.password) return

    setPending(true)
    try {
      await login(trimmedEmail, password)
      navigate(pathAfterAuth(location.state), { replace: true })
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null
      // Неподтверждённый адрес — не ошибка формы, а следующий шаг: ждём письмо
      if (apiError?.code === 'email_not_verified') setVerificationEmail(trimmedEmail)
      else setServerError(apiError)
      setValidation({})
    } finally {
      setPending(false)
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setValidation({ email: trimmedEmail ? 'emailInvalid' : 'emailRequired' })
      return
    }

    setValidation({})
    setResetError(null)
    setResetPending(true)
    try {
      await requestPasswordReset(trimmedEmail)
      setResetSent(true)
    } catch (error) {
      setResetError(error instanceof ApiError ? error : null)
    } finally {
      setResetPending(false)
    }
  }

  if (resetting) {
    return (
      <section>
        <h1>{t('reset.title')}</h1>
        <p className={styles.note}>{t('reset.hint')}</p>
        {resetSent ? (
          <p className={styles.note} role="status">
            {t('reset.sent')}
          </p>
        ) : null}
        {resetError ? (
          <p className={styles.alert} role="alert">
            {errorMessage(resetError)}
          </p>
        ) : null}
        <form className={styles.form} onSubmit={submitReset} noValidate>
          <Field
            label={t('login.email')}
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            error={validation.email ? t(`validation.${validation.email}`) : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button className={styles.submit} type="submit" disabled={resetPending || resetSent}>
            {t('reset.submit')}
          </Button>
        </form>
        <div className={styles.footer}>
          <button
            className={styles.linkButton}
            type="button"
            onClick={() => {
              setResetting(false)
              setResetSent(false)
            }}
          >
            {t('reset.back')}
          </button>
        </div>
      </section>
    )
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
        <button className={styles.linkButton} type="button" onClick={() => setResetting(true)}>
          {t('login.forgot')}
        </button>
        <Link to="/register">{t('login.toRegister')}</Link>
      </div>
      <GoogleSignInButton
        onSignedIn={() => navigate(pathAfterAuth(location.state), { replace: true })}
        onError={(error) => setServerError(error instanceof ApiError ? error : null)}
      />
    </section>
  )
}
