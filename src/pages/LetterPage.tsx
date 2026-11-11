import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { ApiError } from '../api/errors'
import { Envelope, LetterActions, LetterView, lettersPaths, useLetter } from '../features/letters'
import { useReadLetter } from '../features/letters/useLetterActions'
import { errorMessage } from '../shared/i18n/apiError'
import { Button, LinkButton, Spinner } from '../shared/ui'

/**
 * Экран письма. Представление выбирается по полю `view` из ответа сервера: отправитель,
 * конверт в пути или доставленное письмо. Клиент не решает, что показать.
 */
export function LetterPage() {
  const { id } = useParams()
  const { t } = useTranslation('letters')
  const { data, isPending, isError, error, refetch } = useLetter(id ?? '')
  const { mutate: markRead } = useReadLetter()
  // Прочтение — один раз на письмо: повторный заход в уже прочитанное запрос не шлёт.
  const readRequested = useRef<string | null>(null)

  useEffect(() => {
    if (data?.view !== 'incoming' || data.status !== 'delivered') return
    if (readRequested.current === data.id) return
    readRequested.current = data.id
    markRead(data.id)
  }, [data, markRead])

  if (isPending) return <Spinner />

  if (isError) {
    const missing = error instanceof ApiError && error.status === 404
    return (
      <section>
        <h1>{t('letter.title')}</h1>
        <p>{missing ? t('letter.missing') : errorMessage(error)}</p>
        {missing ? null : (
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common:actions.retry')}
          </Button>
        )}
        <p>
          <LinkButton to={lettersPaths.inbox}>{t('inbox.title')}</LinkButton>{' '}
          <LinkButton to={lettersPaths.sent}>{t('sent.title')}</LinkButton>
        </p>
      </section>
    )
  }

  return (
    <section>
      <h1>{t('letter.title')}</h1>
      {data.view === 'incoming_preview' ? <Envelope letter={data} /> : <LetterView letter={data} />}
      {data.view === 'sender' ? <LetterActions letter={data} /> : null}
    </section>
  )
}
