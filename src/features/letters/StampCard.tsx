import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CardBody, CardContainer, CardItem } from '@/components/ui/3d-card'
import { cn } from '@/lib/utils'

import type { Stamp } from '../../api'
import styles from './SealLetterDialog.module.css'
import { stampName } from './stampName'

interface StampCardProps {
  stamp: Stamp
  language: string
  /** Диалог передаёт выбор: карточка становится `label` скрытой радиокнопки с бейджем. */
  checked?: boolean
  onSelect?: () => void
}

/**
 * Карточка марки — 3D-карточка Aceternity (`components/ui/3d-card`): наклоняется за
 * курсором, слои выезжают на разную глубину. Один вид карточки на всём продукте:
 * страница коллекции показывает ею каталог, диалог запечатывания делает её строкой
 * выбора (`checked` + `onSelect` — вся карточка становится `<label>` скрытой
 * радиокнопки, поэтому выбор работает и с клавиатуры, и скринридером).
 * Вид с нулевым остатком виден, но не выбирается: «закончилось» — подсказка, а не запрет.
 */
export function StampCard({ stamp, language, checked = false, onSelect }: StampCardProps) {
  const { t } = useTranslation('letters')
  const out = stamp.quantity === 0
  const selectable = onSelect !== undefined

  const content = (
    <>
      <CardItem as="span" translateZ={50} className="block font-body text-lg text-ink">
        {stampName(stamp, language)}
      </CardItem>
      <CardItem as="span" translateZ={60} className="mt-1 block text-sm text-ink-muted">
        {stamp.description}
      </CardItem>
      <CardItem as="span" translateZ={100} className="mt-3 block w-full">
        <StampImage stamp={stamp} />
      </CardItem>
      <span className="mt-4 flex items-center justify-between gap-2">
        <CardItem
          as="span"
          translateZ={20}
          className={cn('text-sm', out ? 'text-danger' : 'text-ink-muted')}
        >
          {out ? t('seal.out') : t('seal.left', { count: stamp.quantity })}
        </CardItem>
        {selectable && !out ? (
          <CardItem
            as="span"
            translateZ={20}
            aria-hidden="true"
            className={cn(
              'rounded-lg px-3 py-1 text-xs font-bold',
              checked ? 'bg-accent text-accent-ink' : 'border border-line text-ink',
            )}
          >
            {checked ? t('seal.chosen') : t('seal.choose')}
          </CardItem>
        ) : null}
      </span>
    </>
  )

  return (
    <CardContainer containerClassName="py-2" className="w-full">
      <CardBody
        className={cn(
          'relative h-auto w-full rounded-xl border p-4 transition-shadow',
          'border-line bg-surface',
          'hover:shadow-xl hover:shadow-[rgb(43_36_28/12%)]',
          checked && 'border-accent shadow-[inset_0_0_0_1px_var(--color-accent)]',
          out && 'opacity-60',
        )}
      >
        {selectable ? (
          <label
            className={cn(
              'block [transform-style:preserve-3d] has-[:focus-visible]:outline-2',
              'has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-accent',
              out ? 'cursor-not-allowed' : 'cursor-pointer',
            )}
          >
            <input
              type="radio"
              name="stamp"
              className={styles.input}
              checked={checked}
              disabled={out}
              onChange={onSelect}
            />
            {content}
          </label>
        ) : (
          <span className="block [transform-style:preserve-3d]">{content}</span>
        )}
      </CardBody>
    </CardContainer>
  )
}

/**
 * Картинка марки: пока `image_url` пуст у всех видов, рисуется заглушка; ошибившаяся
 * загрузка тоже уступает место заглушке, чтобы битой иконки не было никогда.
 */
function StampImage({ stamp }: { stamp: Stamp }) {
  const [broken, setBroken] = useState(false)
  const size = 'block h-32 w-full rounded-lg'

  if (stamp.image_url === null || broken) {
    return <span className={cn(size, styles.placeholder)} aria-hidden="true" />
  }

  return (
    <img
      className={cn(size, 'object-cover', styles.image)}
      src={stamp.image_url}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
    />
  )
}
