import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Stamp } from '../../api'
import { errorMessage } from '../../shared/i18n/apiError'
import { Button, Dialog, ErrorState, Spinner } from '../../shared/ui'
import styles from './SealLetterDialog.module.css'
import { stampName } from './stampName'
import { useStamps } from './useStamps'

/** Классы строки выбора: активная подсвечена, вид без остатка приглушён. */
function optionClass(active: boolean, out = false): string {
  return [styles.option, active ? styles.optionActive : '', out ? styles.out : '']
    .filter(Boolean)
    .join(' ')
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

/** Вид с нулевым остатком виден, но не выбирается: «закончилось» — подсказка, а не запрет. */
function StampOption({ stamp, language, checked, onSelect }: StampOptionProps) {
  const { t } = useTranslation('letters')
  const out = stamp.quantity === 0

  return (
    <label className={optionClass(checked, out)}>
      <input
        type="radio"
        name="stamp"
        className={styles.input}
        checked={checked}
        disabled={out}
        onChange={onSelect}
      />
      <StampImage stamp={stamp} />
      <span className={styles.optionMain}>
        <span className={styles.optionName}>{stampName(stamp, language)}</span>
        <span className={out ? styles.optionMetaOut : styles.optionMeta}>
          {out ? t('seal.out') : t('seal.left', { count: stamp.quantity })}
        </span>
      </span>
    </label>
  )
}

/**
 * Картинка марки: пока `image_url` пуст у всех видов, рисуется заглушка; ошибившаяся
 * загрузка тоже уступает место заглушке, чтобы битой иконки не было никогда.
 */
function StampImage({ stamp }: { stamp: Stamp }) {
  const [broken, setBroken] = useState(false)

  if (stamp.image_url === null || broken) {
    return <span className={styles.placeholder} aria-hidden="true" />
  }

  return (
    <img
      className={styles.image}
      src={stamp.image_url}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
    />
  )
}
