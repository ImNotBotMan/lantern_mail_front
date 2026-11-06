import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSession } from '../features/session'
import { errorMessage } from '../shared/i18n/apiError'
import { Button } from '../shared/ui'
import styles from './AccountPage.module.css'

export function AccountPage() {
  const { t, i18n } = useTranslation(['auth', 'common'])
  const { user, logout, logoutAll } = useSession()

  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  if (!user) return null

  const createdAt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
    new Date(user.created_at),
  )

  async function handleLogout() {
    setPending(true)
    // Guard уводит на вход, как только сессия стала анонимной.
    await logout()
  }

  async function handleLogoutAll() {
    setPending(true)
    setError(null)
    try {
      await logoutAll()
    } catch (cause) {
      setError(cause)
      setPending(false)
    }
  }

  return (
    <section>
      <h1>{t('account.title')}</h1>
      <dl className={styles.facts}>
        <dt>{t('account.username')}</dt>
        <dd>{user.username ?? user.id}</dd>
        <dt>{t('account.createdAt')}</dt>
        <dd>{createdAt}</dd>
      </dl>

      {error ? (
        <p className={styles.alert} role="alert">
          {errorMessage(error)}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={handleLogout} disabled={pending}>
          {t('account.logout')}
        </Button>

        {confirmingLogoutAll ? (
          <div className={styles.confirm}>
            <p>{t('account.logoutAllQuestion')}</p>
            <div className={styles.confirmActions}>
              <Button variant="danger" onClick={handleLogoutAll} disabled={pending}>
                {t('account.logoutAllConfirm')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmingLogoutAll(false)}
                disabled={pending}
              >
                {t('common:actions.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmingLogoutAll(true)} disabled={pending}>
            {t('account.logoutAll')}
          </Button>
        )}
      </div>
    </section>
  )
}
