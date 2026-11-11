import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { LetterResponse } from '../../api'
import { errorMessage } from '../../shared/i18n/apiError'
import { Button, LinkButton } from '../../shared/ui'
import styles from './letters.module.css'
import { lettersPaths } from './paths'
import { useDeleteLetter, useSealLetter, useSendLetter, useUnsealLetter } from './useLetterActions'

type Pending = 'send' | 'delete' | null

interface LetterActionsProps {
  letter: LetterResponse
  /** `sent-row` — короткий набор для строки списка: только «Отправить» и «Удалить». */
  scope?: 'letter' | 'sent-row'
}

/**
 * Действия отправителя. Кнопки показываются по `status` как подсказка, а допустимость
 * всё равно проверяет сервер: 409 показываем текстом, данные при этом перезапрашиваются.
 * Необратимые шаги («Отправить», «Удалить») сначала спрашивают подтверждение.
 */
export function LetterActions({ letter, scope = 'letter' }: LetterActionsProps) {
  const { t } = useTranslation('letters')
  const navigate = useNavigate()
  const seal = useSealLetter()
  const unseal = useUnsealLetter()
  const send = useSendLetter()
  const remove = useDeleteLetter()

  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<unknown>(null)
  const busy = seal.isPending || unseal.isPending || send.isPending || remove.isPending

  const canEdit = letter.status === 'draft' && scope === 'letter'
  const canSeal = letter.status === 'draft' && scope === 'letter'
  const canUnseal = letter.status === 'sealed' && scope === 'letter'
  const canSend = letter.status === 'sealed'
  const canDelete = letter.status === 'draft' || letter.status === 'sealed'

  async function act(action: () => Promise<unknown>, after?: () => void) {
    setError(null)
    try {
      await action()
      setPending(null)
      after?.()
    } catch (cause) {
      setError(cause)
    }
  }

  if (pending === 'send') {
    return (
      <div className={styles.confirm}>
        <p className={styles.confirmText}>{t('editor.sendConfirm')}</p>
        <div className={styles.confirmActions}>
          <Button onClick={() => void act(() => send.mutateAsync(letter.id))} disabled={busy}>
            {t('editor.sendConfirmYes')}
          </Button>
          <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
            {t('common:actions.cancel')}
          </Button>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {errorMessage(error)}
          </p>
        ) : null}
      </div>
    )
  }

  if (pending === 'delete') {
    return (
      <div className={styles.confirm}>
        <p className={styles.confirmText}>{t('editor.deleteConfirm')}</p>
        <div className={styles.confirmActions}>
          <Button
            variant="danger"
            onClick={() => void act(() => remove.mutateAsync(letter.id))}
            disabled={busy}
          >
            {t('editor.deleteConfirmYes')}
          </Button>
          <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
            {t('common:actions.cancel')}
          </Button>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {errorMessage(error)}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.actions}>
      {canEdit ? (
        <LinkButton to={lettersPaths.editLetter(letter.id)}>{t('editor.edit')}</LinkButton>
      ) : null}
      {canSeal ? (
        <Button
          variant="secondary"
          onClick={() => void act(() => seal.mutateAsync(letter.id))}
          disabled={busy}
        >
          {t('editor.seal')}
        </Button>
      ) : null}
      {canUnseal ? (
        <Button
          variant="secondary"
          onClick={() =>
            void act(
              () => unseal.mutateAsync(letter.id),
              () => navigate(lettersPaths.editLetter(letter.id)),
            )
          }
          disabled={busy}
        >
          {t('editor.unseal')}
        </Button>
      ) : null}
      {canSend ? (
        <Button onClick={() => setPending('send')} disabled={busy}>
          {t('editor.send')}
        </Button>
      ) : null}
      {canDelete ? (
        <Button variant="danger" onClick={() => setPending('delete')} disabled={busy}>
          {t('editor.delete')}
        </Button>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {errorMessage(error)}
        </p>
      ) : null}
    </div>
  )
}
