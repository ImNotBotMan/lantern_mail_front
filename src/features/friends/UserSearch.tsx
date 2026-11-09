import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/errors'
import type { UserSearchResult } from '../../api/types'
import { errorMessage } from '../../shared/i18n/apiError'
import { Badge, Button, EmptyState, ErrorState, Field, Spinner } from '../../shared/ui'
import styles from './FriendsList.module.css'
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useSendFriendRequest,
  useWithdrawFriendRequest,
} from './useFriendRequests'
import { useUnfriend } from './useUnfriend'
import { useUserSearch } from './useUserSearch'

/**
 * Коды, после которых строка не показывает ошибку: мутация сбрасывает списки, и строка
 * перерисовывается по свежему `relationship` (docs/specs/module-friends.md).
 */
function isStaleRelationshipError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'friend_request_exists' ||
      error.code === 'already_friends' ||
      error.code === 'friend_request_not_pending')
  )
}

function SearchResultRow({ result }: { result: UserSearchResult }) {
  const { t } = useTranslation('friends')
  const send = useSendFriendRequest()
  const withdraw = useWithdrawFriendRequest()
  const accept = useAcceptFriendRequest()
  const decline = useDeclineFriendRequest()
  const unfriend = useUnfriend()

  const [confirming, setConfirming] = useState(false)
  const [rowError, setRowError] = useState<unknown>(null)

  const mutating =
    send.isPending || withdraw.isPending || accept.isPending || decline.isPending || unfriend.isPending

  async function act(action: () => Promise<unknown>) {
    setRowError(null)
    try {
      await action()
    } catch (cause) {
      if (!isStaleRelationshipError(cause)) setRowError(cause)
    }
  }

  function actions(): React.ReactNode {
    switch (result.relationship) {
      case 'none':
        return (
          <Button onClick={() => void act(() => send.mutateAsync(result.username))} disabled={mutating}>
            {t('search.add')}
          </Button>
        )
      case 'outgoing_request':
        return (
          <div className={styles.confirmActions}>
            <Badge>{t('search.requested')}</Badge>
            <Button
              variant="secondary"
              disabled={mutating}
              onClick={() => void act(() => withdraw.mutateAsync(result.request_id ?? ''))}
            >
              {t('search.withdraw')}
            </Button>
          </div>
        )
      case 'incoming_request':
        return (
          <div className={styles.confirmActions}>
            <Button
              disabled={mutating}
              onClick={() => void act(() => accept.mutateAsync(result.request_id ?? ''))}
            >
              {t('search.accept')}
            </Button>
            <Button
              variant="secondary"
              disabled={mutating}
              onClick={() => void act(() => decline.mutateAsync(result.request_id ?? ''))}
            >
              {t('search.decline')}
            </Button>
          </div>
        )
      case 'friend':
        if (confirming) {
          return (
            <div className={styles.confirm}>
              <p className={styles.confirmText}>{t('list.unfriendConfirm', { username: result.username })}</p>
              <div className={styles.confirmActions}>
                <Button
                  variant="danger"
                  disabled={mutating}
                  onClick={() => void act(() => unfriend.mutateAsync(result.username))}
                >
                  {t('list.unfriendConfirmYes')}
                </Button>
                <Button variant="secondary" disabled={mutating} onClick={() => setConfirming(false)}>
                  {t('common:actions.cancel')}
                </Button>
              </div>
            </div>
          )
        }
        return (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {t('search.unfriend')}
          </Button>
        )
    }
  }

  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.username}>{result.username}</span>
        {rowError ? (
          <p className={styles.error} role="alert">
            {errorMessage(rowError)}
          </p>
        ) : null}
      </div>
      {actions()}
    </li>
  )
}

export function UserSearch() {
  const { t } = useTranslation('friends')
  const [input, setInput] = useState('')
  const { state, query } = useUserSearch(input)

  const hint =
    state === 'tooShort'
      ? t('search.hint')
      : state === 'invalid'
        ? t('search.invalid')
        : undefined

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2>{t('search.label')}</h2>
      </header>

      <Field
        label={t('search.label')}
        hint={hint}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        type="text"
        autoComplete="off"
      />

      {query.isFetching && !query.isPlaceholderData ? <Spinner /> : null}

      {query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : null}

      {state === 'ready' && query.data && query.data.length === 0 ? (
        <EmptyState message={t('search.empty')} />
      ) : null}

      {query.data && query.data.length > 0 ? (
        <ul className={styles.list}>
          {query.data.map((result) => (
            <SearchResultRow key={result.username} result={result} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
