import { useTranslation } from 'react-i18next'

import type { IncomingLetterPreview } from '../../api'
import { CityPath } from './CityPath'
import styles from './letters.module.css'
import { StatusBadge } from './StatusBadge'

/**
 * Письмо в пути глазами получателя: отправитель и обёртка. Ни текста, ни времени доставки
 * в ответе сервера нет — и экран их не придумывает (docs/specs/module-front-letters.md).
 */
export function Envelope({ letter }: { letter: IncomingLetterPreview }) {
  const { t } = useTranslation('letters')

  return (
    <article className={styles.envelope}>
      <span className={styles.waxSeal} aria-hidden="true" />
      <span className={styles.party}>
        {t('letter.from', { username: letter.sender_username ?? t('letter.unknownSender') })}
      </span>
      <StatusBadge status={letter.status} />
      <CityPath senderCity={letter.sender_city} recipientCity={letter.recipient_city} />
      <p className={styles.note}>{t('letter.inTransitHint')}</p>
    </article>
  )
}
