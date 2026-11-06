import { useTranslation } from 'react-i18next'

import { errorMessage } from '../../shared/i18n/apiError'
import { Button, EmptyState, ErrorState, Spinner } from '../../shared/ui'
import { FriendRow } from './FriendRow'
import styles from './FriendsList.module.css'
import { useFriends } from './useFriends'

export function FriendsList() {
  const { t } = useTranslation('friends')
  const { data, isPending, isError, error, refetch } = useFriends()

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2>{t('list.title')}</h2>
        <Button variant="secondary" onClick={() => void refetch()}>
          {t('common:actions.refresh')}
        </Button>
      </header>

      {isPending ? <Spinner /> : null}

      {isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : null}

      {data && data.length === 0 ? <EmptyState message={t('list.empty')} /> : null}

      {data && data.length > 0 ? (
        <ul className={styles.list}>
          {data.map((friend) => (
            <FriendRow key={friend.username} friend={friend} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
