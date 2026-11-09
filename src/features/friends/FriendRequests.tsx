import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/errors'
import { errorMessage } from '../../shared/i18n/apiError'
import { formatDate } from '../../shared/i18n/formatDate'
import { Button, EmptyState, ErrorState, Spinner } from '../../shared/ui'
import styles from './FriendsList.module.css'
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useIncomingRequests,
  useOutgoingRequests,
  useWithdrawFriendRequest,
} from './useFriendRequests'

/**
 * Коды, после которых строка не показывает ошибку: мутация всё равно сбрасывает списки
 * (docs/specs/module-friends.md) — «заявка уже неактуальна» видна обновлением, а не текстом.
 */
function isStaleRequestError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'friend_request_not_pending' || error.code === 'already_friends')
  )
}

export function IncomingRequests() {
  const { t, i18n } = useTranslation('friends')
  const { data, isPending, isError, error, refetch } = useIncomingRequests()
  const accept = useAcceptFriendRequest()
  const decline = useDeclineFriendRequest()
  const [rowError, setRowError] = useState<unknown>(null)

  async function act(action: (requestId: string) => Promise<unknown>, requestId: string) {
    setRowError(null)
    try {
      await action(requestId)
    } catch (cause) {
      if (!isStaleRequestError(cause)) setRowError(cause)
    }
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2>{t('requests.incoming')}</h2>
        <Button variant="secondary" onClick={() => void refetch()}>
          {t('common:actions.refresh')}
        </Button>
      </header>

      {isPending ? <Spinner /> : null}

      {isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : null}

      {data && data.length === 0 ? (
        <EmptyState message={t('requests.incomingEmpty')} />
      ) : null}

      {data && data.length > 0 ? (
        <ul className={styles.list}>
          {data.map((request) => (
            <li key={request.id} className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.person}>
                  <span className={styles.username}>{request.sender_username}</span>
                  <span className={styles.since}>
                    {t('requests.when', {
                      date: formatDate(request.created_at, i18n.language),
                    })}
                  </span>
                </div>
                {rowError ? (
                  <p className={styles.error} role="alert">
                    {errorMessage(rowError)}
                  </p>
                ) : null}
              </div>
              <div className={styles.confirmActions}>
                <Button
                  onClick={() => void act(accept.mutateAsync, request.id)}
                  disabled={accept.isPending || decline.isPending}
                >
                  {t('requests.accept')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void act(decline.mutateAsync, request.id)}
                  disabled={accept.isPending || decline.isPending}
                >
                  {t('requests.decline')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export function OutgoingRequests() {
  const { t, i18n } = useTranslation('friends')
  const { data, isPending, isError, error, refetch } = useOutgoingRequests()
  const withdraw = useWithdrawFriendRequest()
  const [rowError, setRowError] = useState<unknown>(null)

  async function withdrawRequest(requestId: string) {
    setRowError(null)
    try {
      await withdraw.mutateAsync(requestId)
    } catch (cause) {
      if (!isStaleRequestError(cause)) setRowError(cause)
    }
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2>{t('requests.outgoing')}</h2>
        <Button variant="secondary" onClick={() => void refetch()}>
          {t('common:actions.refresh')}
        </Button>
      </header>

      {isPending ? <Spinner /> : null}

      {isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : null}

      {data && data.length === 0 ? (
        <EmptyState message={t('requests.outgoingEmpty')} />
      ) : null}

      {data && data.length > 0 ? (
        <ul className={styles.list}>
          {data.map((request) => (
            <li key={request.id} className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.person}>
                  <span className={styles.username}>{request.recipient_username}</span>
                  <span className={styles.since}>
                    {t('requests.when', {
                      date: formatDate(request.created_at, i18n.language),
                    })}
                  </span>
                </div>
                {rowError ? (
                  <p className={styles.error} role="alert">
                    {errorMessage(rowError)}
                  </p>
                ) : null}
              </div>
              <Button
                variant="secondary"
                onClick={() => void withdrawRequest(request.id)}
                disabled={withdraw.isPending}
              >
                {t('requests.withdraw')}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
