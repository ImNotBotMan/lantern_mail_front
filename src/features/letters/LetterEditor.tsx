import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker, useNavigate } from 'react-router-dom'

import { ApiError } from '../../api'
import { errorMessage } from '../../shared/i18n/apiError'
import { Button, LinkButton, Spinner, Textarea } from '../../shared/ui'
import { Envelope } from './Envelope'
import { LetterActions } from './LetterActions'
import { LetterView } from './LetterView'
import styles from './letters.module.css'
import { lettersPaths } from './paths'
import { RecipientSelect } from './RecipientSelect'
import { SealLetterDialog } from './SealLetterDialog'
import {
  useCreateLetter,
  useDeleteLetter,
  useSealLetter,
  useUpdateLetter,
} from './useLetterActions'
import { useLetter } from './useLetters'

/** Предел тела письма в контракте бэкенда; дублируем, чтобы ошибку не ждать от сервера. */
const BODY_MAX_LENGTH = 10_000

interface LetterEditorProps {
  /** Нет id — новое письмо: черновик появляется на сервере по кнопке «Сохранить». */
  letterId?: string
}

/**
 * Редактор черновика. Поля живут локально до явного «Сохранить»: автосохранения нет,
 * поэтому уход со страницы с несохранённым текстом спрашивает подтверждение.
 */
export function LetterEditor({ letterId }: LetterEditorProps) {
  const { t } = useTranslation('letters')
  const navigate = useNavigate()
  const create = useCreateLetter()
  const update = useUpdateLetter()
  const seal = useSealLetter()
  const remove = useDeleteLetter()
  const { data: letter, isPending, isError, error, refetch } = useLetter(letterId ?? '')

  const [recipient, setRecipient] = useState('')
  const [body, setBody] = useState('')
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sealing, setSealing] = useState(false)
  // Программный переход после сохранения или удаления не должен спрашивать про несохранённое.
  const leaving = useRef(false)
  // id черновика, сохранённого в первой попытке запечатать: повтор не плодит второй.
  const draftId = useRef<string | null>(null)

  const saved = letter?.view === 'sender' ? letter : null
  const dirty = saved
    ? recipient !== (saved.recipient_username ?? '') || body !== saved.body
    : recipient !== '' || body !== ''

  // Поля заполняются один раз на письмо: перезапрос после мутации не должен затирать правки.
  useEffect(() => {
    if (!saved || loadedId === saved.id) return
    setRecipient(saved.recipient_username ?? '')
    setBody(saved.body)
    setLoadedId(saved.id)
    leaving.current = false
  }, [saved, loadedId])

  // Закрытие вкладки предотвратить нельзя — браузер спрашивает сам.
  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  )
  const blocked = blocker.state === 'blocked' ? blocker : null

  const busy = create.isPending || update.isPending || seal.isPending || remove.isPending

  /**
   * Сохраняет письмо и возвращает его id: существующий черновик обновляется, новый создаётся
   * первым сохранением. `knownId` — черновик, созданный прошлой попыткой запечатать.
   */
  async function persist(knownId: string | null = saved?.id ?? null): Promise<string> {
    const payload = { recipient_username: recipient === '' ? null : recipient, body }
    if (knownId) {
      await update.mutateAsync({ id: knownId, data: payload })
      return knownId
    }
    const created = await create.mutateAsync(payload)
    return created.id
  }

  async function run(action: () => Promise<void>) {
    setFailure(null)
    try {
      await action()
    } catch (cause) {
      setFailure(cause)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      const id = await persist()
      if (!saved) {
        leaving.current = true
        navigate(lettersPaths.editLetter(id), { replace: true })
      }
    })
  }

  /**
   * Запечатать можно только с получателем и текстом — то же правило проверяет сервер.
   * Черновик сохраняется первым шагом: марка прикладывается к письму, у которого уже есть id.
   * Повтор после ошибки запечатывает уже сохранённый черновик, а не создаёт второй.
   * Ошибка уходит в диалог выбора марки, а не в общий список ошибок редактора.
   */
  async function sealAndOpen(stampId: number | null) {
    const id = await persist(saved?.id ?? draftId.current)
    draftId.current = id
    await seal.mutateAsync({ id, stampId })
    leaving.current = true
    setSealing(false)
    navigate(lettersPaths.letter(id), { replace: true })
  }

  async function deleteLetter() {
    if (!saved) return
    await run(async () => {
      await remove.mutateAsync(saved.id)
      leaving.current = true
      navigate(lettersPaths.sent, { replace: true })
    })
  }

  if (letterId && isPending) return <Spinner />

  if (letterId && isError) {
    const missing = error instanceof ApiError && error.status === 404
    return (
      <section>
        <h1>{t('editor.editTitle')}</h1>
        <p className={styles.note}>{missing ? t('letter.missing') : errorMessage(error)}</p>
        {missing ? null : (
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common:actions.retry')}
          </Button>
        )}
        <p>
          <LinkButton to={lettersPaths.sent}>{t('sent.title')}</LinkButton>
        </p>
      </section>
    )
  }

  // Чужое письмо: получателю редактор не положен, показываем письмо как есть.
  if (letter && letter.view !== 'sender') {
    return (
      <section>
        <h1>{t('editor.title')}</h1>
        <p className={styles.note}>{t('editor.notEditable')}</p>
        {letter.view === 'incoming' ? <LetterView letter={letter} /> : <Envelope letter={letter} />}
      </section>
    )
  }

  // Черновик уже запечатан: редактирование недоступно, действия — на экране письма.
  if (saved && saved.status !== 'draft') {
    return (
      <section>
        <h1>{t('editor.editTitle')}</h1>
        <p className={styles.note}>{t('editor.notEditable')}</p>
        <LetterView letter={saved} />
        <LetterActions letter={saved} />
      </section>
    )
  }

  return (
    <>
      <form className={styles.editor} onSubmit={(event) => void save(event)}>
        <h1>{saved ? t('editor.editTitle') : t('editor.title')}</h1>

        <RecipientSelect value={recipient} onChange={setRecipient} disabled={busy} />

        <Textarea
          label={t('editor.body')}
          value={body}
          rows={12}
          maxLength={BODY_MAX_LENGTH}
          placeholder={t('editor.bodyPlaceholder')}
          disabled={busy}
          onChange={(event) => setBody(event.target.value)}
        />

        {failure ? (
          <p className={styles.error} role="alert">
            {errorMessage(failure)}
          </p>
        ) : null}

        <div className={styles.editorActions}>
          <Button type="submit" disabled={!dirty || busy}>
            {t('editor.save')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setSealing(true)}
            disabled={recipient === '' || body.trim() === '' || busy}
          >
            {t('editor.seal')}
          </Button>
          {saved ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
              {t('editor.delete')}
            </Button>
          ) : null}
        </div>

        {confirmDelete ? (
          <div className={styles.unsaved}>
            <p>{t('editor.deleteConfirm')}</p>
            <div className={styles.confirmActions}>
              <Button variant="danger" onClick={() => void deleteLetter()} disabled={busy}>
                {t('editor.deleteConfirmYes')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={busy}>
                {t('common:actions.cancel')}
              </Button>
            </div>
          </div>
        ) : null}

        {blocked ? (
          <div className={styles.unsaved}>
            <p>{t('editor.unsaved')}</p>
            <div className={styles.confirmActions}>
              <Button onClick={() => blocked.proceed()}>{t('editor.unsavedLeave')}</Button>
              <Button variant="secondary" onClick={() => blocked.reset()}>
                {t('editor.unsavedStay')}
              </Button>
            </div>
          </div>
        ) : null}
      </form>

      {sealing ? <SealLetterDialog onSeal={sealAndOpen} onClose={() => setSealing(false)} /> : null}
    </>
  )
}
