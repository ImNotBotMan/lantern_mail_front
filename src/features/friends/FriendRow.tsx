import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/errors'
import type { Friend } from '../../api/types'
import { errorMessage } from '../../shared/i18n/apiError'
import { formatDate } from '../../shared/i18n/formatDate'
import { Button } from '../../shared/ui'
import styles from './FriendsList.module.css'
import { useUnfriend } from './useUnfriend'

export function FriendRow({ friend }: { friend: Friend }) {
  const { t, i18n } = useTranslation('friends')
  const unfriend = useUnfriend()

  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function remove() {
    setError(null)
    try {
      await unfriend.mutateAsync(friend.username)
    } catch (cause) {
      // «Друга уже нет» — не ошибка: мутация сама сбрасывает списки, строка исчезнет.
      if (!(cause instanceof ApiError && cause.code === 'not_found')) setError(cause)
    }
  }

  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.person}>
          <span className={styles.username}>{friend.username}</span>
          <span className={styles.since}>
            {t('list.since', { date: formatDate(friend.friends_since, i18n.language) })}
          </span>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {errorMessage(error)}
          </p>
        ) : null}
      </div>

      {confirming ? (
        <div className={styles.confirm}>
          <p className={styles.confirmText}>
            {t('list.unfriendConfirm', { username: friend.username })}
          </p>
          <div className={styles.confirmActions}>
            <Button variant="danger" onClick={remove} disabled={unfriend.isPending}>
              {t('list.unfriendConfirmYes')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={unfriend.isPending}
            >
              {t('common:actions.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          {t('list.unfriend')}
        </Button>
      )}
    </li>
  )
}
