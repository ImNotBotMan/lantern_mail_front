import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { errorMessage } from '../../shared/i18n/apiError'
import { Button, EmptyState, ErrorState, Spinner } from '../../shared/ui'
import { inboxDateLine } from './dates'
import styles from './letters.module.css'
import { lettersPaths } from './paths'
import { StatusBadge } from './StatusBadge'
import { useInboxLetters } from './useLetters'

/**
 * Входящие: конверты в пути и доставленные письма. Текст конверта и время доставки в ответе
 * сервера отсутствуют — строка про них молчит, а не гадает (docs/specs/module-front-letters.md).
 */
export function InboxList() {
  const { t, i18n } = useTranslation('letters')
  const { data, isPending, isError, error, refetch } = useInboxLetters()

  return (
    <section>
      <div className={styles.toolbar}>
        <Button variant="secondary" onClick={() => void refetch()}>
          {t('common:actions.refresh')}
        </Button>
      </div>

      {isPending ? <Spinner /> : null}

      {isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : null}

      {data && data.length === 0 ? <EmptyState message={t('inbox.empty')} /> : null}

      {data && data.length > 0 ? (
        <ul className={styles.list}>
          {data.map((letter) => {
            const date = inboxDateLine(letter, t, i18n.language)

            return (
              <li key={letter.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.titleLine}>
                    <Link to={lettersPaths.letter(letter.id)} className={styles.rowTitle}>
                      {letter.sender_username ?? t('letter.unknownSender')}
                    </Link>
                    <StatusBadge status={letter.status} />
                  </span>
                  <span className={styles.rowMeta}>{date ?? t('inbox.onTheWay')}</span>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
