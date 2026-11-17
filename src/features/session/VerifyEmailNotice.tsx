import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '../../shared/i18n/apiError'
import { Button } from '../../shared/ui'
import styles from './VerifyEmailNotice.module.css'

/** Сколько ждать перед повторной отправкой письма: сервер шлёт его на каждую попытку. */
export const RESEND_COOLDOWN_SECONDS = 60

/** Что вернул повтор: письмо ушло ещё раз или адрес уже подтвердили и вход состоялся. */
export type ResendResult = 'sent' | 'verified'

interface VerifyEmailNoticeProps {
  email: string
  onResend: () => Promise<ResendResult>
  /** Адрес подтвердили — сессия уже открыта, экран уводит в продукт. */
  onVerified: () => void
}

/**
 * Экран «проверьте почту»: без подтверждённого адреса входа нет ни одним способом.
 * Повторная отправка — это повтор попытки входа, поэтому пароль остаётся в состоянии
 * страницы, а не запрашивается снова.
 */
export function VerifyEmailNotice({ email, onResend, onVerified }: VerifyEmailNoticeProps) {
  const { t } = useTranslation('auth')
  const [pending, setPending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function resend() {
    setPending(true)
    setError(null)
    try {
      const result = await onResend()
      if (result === 'verified') {
        onVerified()
        return
      }
      setResent(true)
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (cause) {
      setError(cause)
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <h1>{t('verify.title')}</h1>
      <p className={styles.text}>{t('verify.text', { email })}</p>
      {resent ? (
        <p className={styles.note} role="status">
          {t('verify.resent')}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {errorMessage(error)}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={() => void resend()}
          disabled={pending || cooldown > 0}
        >
          {cooldown > 0 ? t('verify.cooldown', { seconds: cooldown }) : t('verify.resend')}
        </Button>
      </div>
    </section>
  )
}
