import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { errorMessage } from '../../shared/i18n/apiError'
import { Button, EmptyState, ErrorState, Spinner } from '../../shared/ui'
import { sentDateLine } from './dates'
import { LetterActions } from './LetterActions'
import styles from './letters.module.css'
import { lettersPaths } from './paths'
import { StatusBadge } from './StatusBadge'
import { useSentLetters } from './useLetters'

/**
 * Отправленные: всё, что писал сам пользователь. Статус, форма и порядок — с сервера;
 * действия над письмом — в общей панели `LetterActions`.
 */
export function SentList() {
  const { t, i18n } = useTranslation('letters')
  const { data, isPending, isError, error, refetch } = useSentLetters()

  return (
    <section>
      <div className={styles.toolbar}>
        <Button variant="secondary" onClick={() => void refetch()}>
          {t('common:actions.refresh')}
        </Button>
      </div>

      {isPending ? <Spinner /> : null}

      {isError ? <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} /> : null}

      {data && data.length === 0 ? <EmptyState message={t('sent.empty')} /> : null}

      {data && data.length > 0 ? (
        <ul className={styles.list}>
          {data.map((letter) => (
            <li key={letter.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.titleLine}>
                  <Link to={lettersPaths.letter(letter.id)} className={styles.rowTitle}>
                    {letter.recipient_username ?? t('letter.noRecipient')}
                  </Link>
                  <StatusBadge status={letter.status} />
                </span>
                <span className={styles.rowMeta}>{sentDateLine(letter, t, i18n.language)}</span>
              </div>

              <LetterActions letter={letter} scope="sent-row" />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
