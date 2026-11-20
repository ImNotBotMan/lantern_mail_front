import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api'
import type { AnyLetter } from '../../api'
import { errorMessage } from '../../shared/i18n/apiError'
import { Badge, Button, EmptyState, ErrorState, LinkButton, Spinner } from '../../shared/ui'
import { Envelope, LetterView } from '../letters'
import { useSession } from '../session'
import { ChatComposer } from './ChatComposer'
import { chatTitle } from './chatTitle'
import styles from './chats.module.css'
import { chatsPaths } from './paths'
import { SealedLetters } from './SealedLetters'
import { useReadOnShow } from './useChatActions'
import { useConversationFeed } from './useChats'

/** Письмо в ленте целиком; летящее чужое — конверт без текста и времени доставки. */
function FeedLetter({ letter }: { letter: AnyLetter }) {
  return (
    <li className={letter.view === 'sender' ? styles.mine : styles.theirs}>
      {letter.view === 'incoming_preview' ? (
        <Envelope letter={letter} />
      ) : (
        <LetterView letter={letter} />
      )}
    </li>
  )
}

/**
 * Диалог: лента писем с подгрузкой более ранних и композер под ней. Можно ли писать, решает
 * сервер полем `can_write`; клиент лишь прячет композер у замороженного чата.
 */
export function ChatFeed({ id }: { id: string }) {
  const { t } = useTranslation('chats')
  const { user } = useSession()
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isRefetchError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useConversationFeed(id)

  const letters = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data])
  useReadOnShow(letters)

  const conversation = data?.pages[0]?.conversation

  if (isPending) return <Spinner />

  if (isError && !conversation) {
    const missing = error instanceof ApiError && error.status === 404
    return (
      <section>
        {missing ? (
          <EmptyState message={t('chat.missing')} />
        ) : (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        )}
        <LinkButton to={chatsPaths.list}>{t('chat.back')}</LinkButton>
      </section>
    )
  }

  if (!conversation) return null

  const recipient = conversation.is_self ? user?.username : conversation.peer_username
  // Сервер отдаёт новые вперёд; в ленте читаем сверху вниз, чтобы последнее было у композера.
  const chronological = [...letters].reverse()

  return (
    <section>
      <header className={styles.chatHeader}>
        <h1>{chatTitle(conversation, t)}</h1>
        {conversation.can_write ? null : <Badge tone="muted">{t('list.frozen')}</Badge>}
        <LinkButton to={chatsPaths.list}>{t('chat.back')}</LinkButton>
      </header>

      {isRefetchError ? (
        <p className={styles.alert} role="alert">
          {t('chat.refreshFailed', { reason: errorMessage(error) })}
        </p>
      ) : null}

      {hasNextPage ? (
        <div className={styles.earlier}>
          {isFetchNextPageError ? (
            <p className={styles.alert} role="alert">
              {errorMessage(error)}
            </p>
          ) : null}
          <Button
            variant="secondary"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? t('common:state.loading') : t('chat.earlier')}
          </Button>
        </div>
      ) : null}

      {chronological.length === 0 ? (
        <EmptyState message={t('chat.empty')} />
      ) : (
        <ol className={styles.feed}>
          {chronological.map((letter) => (
            <FeedLetter key={letter.id} letter={letter} />
          ))}
        </ol>
      )}

      {conversation.can_write && recipient ? (
        <>
          <SealedLetters recipient={recipient} />
          <ChatComposer recipient={recipient} />
        </>
      ) : null}
      {conversation.can_write ? null : <p className={styles.frozen}>{t('chat.frozen')}</p>}
    </section>
  )
}
