import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CardBody, CardContainer, CardItem } from '@/components/ui/3d-card'
import { cn } from '@/lib/utils'

import type { Stamp } from '../../api'
import { errorMessage } from '../../shared/i18n/apiError'
import { Button, Dialog, ErrorState, Spinner } from '../../shared/ui'
import styles from './SealLetterDialog.module.css'
import { stampName } from './stampName'
import { useStamps } from './useStamps'

/** Классы строки «без марки»: активная подсвечена. */
function optionClass(active: boolean): string {
  return cn(styles.option, active && styles.optionActive)
}

interface SealLetterDialogProps {
  /** Запечатать с маркой или без неё (`null`). Ошибка остаётся в диалоге, выбор не пропадает. */
  onSeal: (stampId: number | null) => Promise<void>
  onClose: () => void
}

/**
 * Выбор марки на запечатывание. Один компонент на все места (экран письма, редактор
 * черновика, композер чата): предусловия вроде «сначала сохранить черновик» остаются у
 * вызывающего, диалог владеет только выбором, ожиданием и показом ошибки.
 *
 * Правило «нельзя выбрать то, чего нет» здесь подсказка: настоящую проверку делает сервер
 * (`not_enough_stamps`, `stamp_not_found`), и его ответ показывается текстом.
 */
export function SealLetterDialog({ onSeal, onClose }: SealLetterDialogProps) {
  const { t, i18n } = useTranslation('letters')
  const stamps = useStamps()
  const [stampId, setStampId] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)

  async function confirm() {
    setFailure(null)
    setPending(true)
    try {
      await onSeal(stampId)
    } catch (cause) {
      setFailure(cause)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      title={t('seal.title')}
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <Button onClick={() => void confirm()} disabled={pending}>
            {pending ? t('seal.pending') : t('seal.confirm')}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t('common:actions.cancel')}
          </Button>
        </>
      }
    >
      <p className={styles.hint}>{t('seal.hint')}</p>

      <fieldset className={styles.stamps} disabled={pending}>
        <legend className={styles.legend}>{t('seal.legend')}</legend>

        <label className={optionClass(stampId === null)}>
          <input
            type="radio"
            name="stamp"
            className={styles.input}
            checked={stampId === null}
            data-autofocus
            onChange={() => setStampId(null)}
          />
          <span className={styles.optionMain}>
            <span className={styles.optionName}>{t('seal.noStamp')}</span>
            <span className={styles.optionMeta}>{t('seal.noStampHint')}</span>
          </span>
        </label>

        {stamps.isPending ? <Spinner /> : null}

        {stamps.isError ? (
          <ErrorState message={errorMessage(stamps.error)} onRetry={() => void stamps.refetch()} />
        ) : null}

        {stamps.data?.map((stamp) => (
          <StampOption
            key={stamp.id}
            stamp={stamp}
            language={i18n.language}
            checked={stampId === stamp.id}
            onSelect={() => setStampId(stamp.id)}
          />
        ))}
      </fieldset>

      {failure ? (
        <p className={styles.error} role="alert">
          {errorMessage(failure)}
        </p>
      ) : null}
    </Dialog>
  )
}

interface StampOptionProps {
  stamp: Stamp
  language: string
  checked: boolean
  onSelect: () => void
}

/**
 * Марка — 3D-карточка Aceternity (`components/ui/3d-card`): наклоняется за курсором, слои
 * выезжают на разную глубину. Вся карточка — `<label>` скрытой радиокнопки, поэтому выбор
 * работает и с клавиатуры, и скринридером. Вид с нулевым остатком виден, но не выбирается:
 * «закончилось» — подсказка, а не запрет.
 */
function StampOption({ stamp, language, checked, onSelect }: StampOptionProps) {
  const { t } = useTranslation('letters')
  const out = stamp.quantity === 0

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
            {out ? null : (
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
            )}
          </span>
        </label>
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
