import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { authApi } from '../api/endpoints/auth'
import { ApiError } from '../api/errors'
import { errorMessage } from '../shared/i18n/apiError'
import { Button, Field } from '../shared/ui'
import styles from './auth.module.css'

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

/** Столько ждём перед повторной отправкой: Firebase не должен получать письма по кругу. */
const RESEND_COOLDOWN_MS = 60_000

type FieldCheck = 'emailRequired' | 'emailInvalid'

/**
 * Восстановление пароля: письмо со ссылкой шлёт Firebase, страницу смены пароля отдаёт он же.
 * Ответ 204 одинаков для известного и неизвестного адреса, поэтому подтверждение нейтрально.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation('auth')

  const [email, setEmail] = useState('')
  const [validation, setValidation] = useState<FieldCheck | null>(null)
  const [serverError, setServerError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(false)
  /** Адрес, на который письмо уже отправлено; null — показываем форму. */
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  /** Когда повторная отправка снова доступна; отсчёт живёт в состоянии страницы. */
  const [retryAt, setRetryAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (retryAt === null) return
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= retryAt) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [retryAt])

  const secondsLeft = retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - now) / 1000))

  /** Часы и дедлайн ставятся вместе, иначе первый отсчёт начинается с 61 с. */
  function startCooldown() {
    const startedAt = Date.now()
    setNow(startedAt)
    setRetryAt(startedAt + RESEND_COOLDOWN_MS)
  }

  async function send(address: string, isRetry: boolean) {
    setPending(true)
    setServerError(null)
    try {
      await authApi.requestPasswordReset(address)
      setSentEmail(address)
      startCooldown()
    } catch (error) {
      setServerError(error instanceof ApiError ? error : null)
      // Неудачная повторная попытка тоже упирается в минуту ожидания.
      if (isRetry) startCooldown()
    } finally {
      setPending(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setValidation('emailRequired')
      return
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setValidation('emailInvalid')
      return
    }
    setValidation(null)
    await send(trimmedEmail, false)
  }

  return (
    <section>
      {sentEmail === null ? (
        <>
          <h1>{t('forgot.title')}</h1>
          <p className={styles.intro}>{t('forgot.intro')}</p>
          {serverError ? (
            <p className={styles.alert} role="alert">
              {errorMessage(serverError)}
            </p>
          ) : null}
          <form className={styles.form} onSubmit={submit} noValidate>
            <Field
              label={t('forgot.email')}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              error={validation ? t(`validation.${validation}`) : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button className={styles.submit} type="submit" disabled={pending}>
              {pending ? t('forgot.sending') : t('forgot.submit')}
            </Button>
          </form>
        </>
      ) : (
        <>
          <h1>{t('forgot.sentTitle')}</h1>
          <p className={styles.intro}>{t('forgot.sentBody', { email: sentEmail })}</p>
          {serverError ? (
            <p className={styles.alert} role="alert">
              {errorMessage(serverError)}
            </p>
          ) : null}
          <div className={styles.resend}>
            {pending ? (
              <Button disabled>{t('forgot.sending')}</Button>
            ) : secondsLeft > 0 ? (
              <p className={styles.cooldown}>{t('forgot.retryIn', { seconds: secondsLeft })}</p>
            ) : (
              <Button onClick={() => void send(sentEmail, true)}>{t('forgot.retry')}</Button>
            )}
          </div>
        </>
      )}
      <div className={styles.footer}>
        <Link to="/login">{t('forgot.toLogin')}</Link>
      </div>
    </section>
  )
}
