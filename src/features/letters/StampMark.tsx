import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { IncomingLetter, LetterResponse } from '../../api'
import { Dialog } from '../../shared/ui'
import styles from './letters.module.css'
import { StampCard } from './StampCard'
import { stampName } from './stampName'
import { useStamps } from './useStamps'

type StampedLetter = LetterResponse | IncomingLetter

/**
 * Марка, приложенная к письму: полная 3D-карточка в углу статьи, нажатие открывает ту же
 * карточку крупным планом поверх затемнения — без заголовков и кнопок (Esc или клик мимо).
 * Видят её оба, но по-разному: отправитель всегда (это его письмо и его марка), получатель —
 * только после доставки, поэтому конверт в пути (`Envelope`) компонент не ставит, хотя id
 * в его ответе есть.
 *
 * Данные берутся из кэша `['stamps']` — того же, что у диалога запечатывания и вкладки
 * коллекции. Каталог не загружен — ничего не рисуем (без мигания); id есть, а вида в
 * каталоге нет — карточку собрать не из чего, остаётся маленькая заглушка без названия
 * и без крупного плана.
 */
export function StampMark({ letter }: { letter: StampedLetter }) {
  const { t, i18n } = useTranslation('letters')
  const stamps = useStamps()
  const [open, setOpen] = useState(false)

  const stampId = letter.wrapper.stamp_id
  const stamp = stamps.data?.find((item) => item.id === stampId)

  if (stampId === null || !stamps.data) return null

  return (
    <>
      <span className={styles.letterStamp}>
        {stamp ? (
          <button
            type="button"
            className={styles.stampOpen}
            aria-label={t('letter.stampOf', { name: stampName(stamp, i18n.language) })}
            onClick={() => setOpen(true)}
          >
            <StampCard stamp={stamp} language={i18n.language} />
          </button>
        ) : (
          <span
            role="img"
            aria-label={t('letter.stamp')}
            className={`${styles.stampThumb} ${styles.stampPlaceholder}`}
          />
        )}
      </span>

      {open && stamp ? (
        <Dialog plain title={stampName(stamp, i18n.language)} onClose={() => setOpen(false)}>
          <StampCard stamp={stamp} language={i18n.language} />
        </Dialog>
      ) : null}
    </>
  )
}
