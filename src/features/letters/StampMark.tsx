import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { IncomingLetter, LetterResponse } from '../../api'
import { Dialog } from '../../shared/ui'
import styles from './letters.module.css'
import { stampName } from './stampName'
import { useStamps } from './useStamps'

type StampedLetter = LetterResponse | IncomingLetter

/**
 * Марка, приложенная к письму: миниатюра в углу с названием из каталога, по нажатию —
 * крупным планом поверх экрана. Видят её оба, но по-разному: отправитель всегда
 * (это его письмо и его марка), получатель — только после доставки, поэтому конверт
 * в пути (`Envelope`) компонент не ставит, хотя id в его ответе есть.
 *
 * Данные берутся из кэша `['stamps']` — того же, что у диалога запечатывания и вкладки
 * коллекции. Каталог не загружен — ничего не рисуем (без мигания заглушкой); id есть,
 * а вида в каталоге нет — заглушка без названия. Ошибившаяся загрузка картинки тоже
 * уступает ей место.
 */
export function StampMark({ letter }: { letter: StampedLetter }) {
  const { t, i18n } = useTranslation('letters')
  const stamps = useStamps()
  const [open, setOpen] = useState(false)

  const stampId = letter.wrapper.stamp_id
  const stamp = stamps.data?.find((item) => item.id === stampId)

  if (stampId === null || !stamps.data) return null

  const name = stamp ? stampName(stamp, i18n.language) : null

  return (
    <span className={styles.stampMark}>
      <button
        type="button"
        className={styles.stampButton}
        aria-label={name ? t('letter.stampOf', { name }) : t('letter.stamp')}
        onClick={() => setOpen(true)}
      >
        <StampPicture stamp={stamp} />
      </button>
      {name ? <span className={styles.stampName}>{name}</span> : null}

      {open ? (
        <Dialog
          title={name ?? t('letter.stamp')}
          onClose={() => setOpen(false)}
          footer={
            <button
              type="button"
              className="rounded-md border border-line px-3 py-2 text-sm"
              data-autofocus
              onClick={() => setOpen(false)}
            >
              {t('common:actions.close')}
            </button>
          }
        >
          <StampPicture stamp={stamp} large />
        </Dialog>
      ) : null}
    </span>
  )
}

/**
 * Картинка марки: пока `image_url` пуст у всех видов, рисуется заглушка; ошибившаяся
 * загрузка тоже уступает ей место, чтобы битой картинки не было никогда.
 */
function StampPicture({
  stamp,
  large = false,
}: {
  stamp: { image_url: string | null } | undefined
  large?: boolean
}) {
  const [broken, setBroken] = useState(false)

  if (stamp?.image_url === undefined || stamp.image_url === null || broken) {
    return (
      <span
        aria-hidden="true"
        className={cn(large ? styles.stampLarge : styles.stampThumb, styles.stampPlaceholder)}
      />
    )
  }

  return (
    <img
      className={large ? styles.stampLarge : styles.stampThumb}
      src={stamp.image_url}
      alt=""
      onError={() => setBroken(true)}
    />
  )
}
