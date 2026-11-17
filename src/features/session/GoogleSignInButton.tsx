import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GoogleSignInError, isGoogleSignInEnabled } from '../../shared/firebase'
import { Button } from '../../shared/ui'
import { loginWithGoogle } from './sessionStore'
import styles from './GoogleSignInButton.module.css'

interface GoogleSignInButtonProps {
  /** Вход состоялся: страница решает, куда идти дальше. */
  onSignedIn: () => void
  /** Ошибки сервера — их текст знает только страница (`errorMessage`). */
  onError: (error: unknown) => void
}

/**
 * Кнопка «Продолжить с Google» вместе с окном входа и разбором его отказов.
 * Без настроенного проекта Firebase не рендерится вовсе.
 */
export function GoogleSignInButton({ onSignedIn, onError }: GoogleSignInButtonProps) {
  const { t } = useTranslation('auth')
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  if (!isGoogleSignInEnabled()) return null

  async function handleClick() {
    setPending(true)
    setFailure(null)
    try {
      await loginWithGoogle()
      onSignedIn()
    } catch (error) {
      if (error instanceof GoogleSignInError) {
        // Закрытое человеком окно — не ошибка: форма остаётся как была, без баннера
        if (error.reason !== 'cancelled') setFailure(error.reason)
      } else {
        onError(error)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.block}>
      <p className={styles.divider}>{t('login.or')}</p>
      <Button variant="secondary" onClick={() => void handleClick()} disabled={pending}>
        {t('login.google')}
      </Button>
      {failure ? (
        <p className={styles.error} role="alert">
          {t(`google.${failure}`)}
        </p>
      ) : null}
    </div>
  )
}
