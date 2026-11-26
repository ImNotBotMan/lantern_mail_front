import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { errorMessage } from '../../shared/i18n/apiError'
import { Button, Dialog, ErrorState, Spinner } from '../../shared/ui'
import styles from './SealLetterDialog.module.css'
import { StampCard } from './StampCard'
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
          <StampCard
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
