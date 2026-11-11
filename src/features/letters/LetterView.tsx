import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import type { IncomingLetter, LetterResponse } from '../../api'
import { CityPath } from './CityPath'
import { letterDates } from './dates'
import styles from './letters.module.css'
import { StatusBadge } from './StatusBadge'

type Letter = LetterResponse | IncomingLetter

/**
 * Письмо целиком: отправитель видит все моменты, получатель — доставку и прочтение.
 * Ничего не досочиняется: если момента нет в ответе, нет и строки.
 */
export function LetterView({ letter }: { letter: Letter }) {
  const { t, i18n } = useTranslation('letters')
  const dates = letterDates(letter, t, i18n.language)

  const party =
    letter.view === 'sender'
      ? t('letter.to', { username: letter.recipient_username ?? t('letter.noRecipient') })
      : t('letter.from', { username: letter.sender_username ?? t('letter.unknownSender') })

  return (
    <article className={styles.letter}>
      <header className={styles.letterHeader}>
        <span className={styles.party}>{party}</span>
        <StatusBadge status={letter.status} />
      </header>

      <CityPath senderCity={letter.sender_city} recipientCity={letter.recipient_city} />

      {dates.length > 0 ? (
        <dl className={styles.dates}>
          {dates.map((row) => (
            <Fragment key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </Fragment>
          ))}
        </dl>
      ) : null}

      <p className={styles.body}>{letter.body}</p>
    </article>
  )
}
