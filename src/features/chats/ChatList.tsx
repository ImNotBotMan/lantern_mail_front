import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import type { ConversationCard } from '../../api'
import { errorMessage } from '../../shared/i18n/apiError'
import { formatDate } from '../../shared/i18n/formatDate'
import { Badge, Button, EmptyState, ErrorState, Spinner } from '../../shared/ui'
import { chatTitle } from './chatTitle'
import styles from './chats.module.css'
import { chatsPaths } from './paths'
import { useConversations } from './useChats'

function Preview({ preview }: { preview: ConversationCard['preview'] }) {
  const { t } = useTranslation('chats')

  // У чужого летящего письма текста в ответе нет — превью говорит только, что оно в пути.
  if (preview.kind === 'in_transit') {
    return <p className={`${styles.preview} ${styles.previewInTransit}`}>{t('list.inTransit')}</p>
  }
  return preview.body ? <p className={styles.preview}>{preview.body}</p> : null
}

/** Список диалогов в порядке сервера: новые вперёд, «Себе» — в конце. */
export function ChatList() {
  const { t, i18n } = useTranslation('chats')
  const { data, isPending, isError, error, refetch } = useConversations()

  return (
    <section>
      <div className={styles.toolbar}>
        <Button variant="secondary" onClick={() => void refetch()}>
          {t('common:actions.refresh')}
        </Button>
      </div>

      {isPending ? <Spinner /> : null}

      {isError ? <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} /> : null}

      {data && data.length === 0 ? <EmptyState message={t('list.empty')} /> : null}

      {data && data.length > 0 ? (
        <ul className={styles.list}>
          {data.map((conversation) => (
            <li key={conversation.id} className={styles.card}>
              <span className={styles.cardTitle}>
                <Link to={chatsPaths.chat(conversation.id)} className={styles.cardLink}>
                  {chatTitle(conversation, t)}
                </Link>
                {conversation.can_write ? null : <Badge tone="muted">{t('list.frozen')}</Badge>}
                <time className={styles.cardTime} dateTime={conversation.last_event_at}>
                  {formatDate(conversation.last_event_at, i18n.language, 'medium')}
                </time>
              </span>
              <Preview preview={conversation.preview} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
