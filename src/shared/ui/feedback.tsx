import { useTranslation } from 'react-i18next'

import { Button } from './Button'
import styles from './feedback.module.css'

export function Spinner() {
  const { t } = useTranslation()
  return (
    <div className={styles.block} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{t('state.loading')}</span>
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className={styles.block}>{message}</div>
}

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div className={styles.block} role="alert">
      <span>{message}</span>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      ) : null}
    </div>
  )
}
