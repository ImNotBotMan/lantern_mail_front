import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '../../shared/i18n/apiError'
import { Button, Textarea } from '../../shared/ui'
import styles from './chats.module.css'
import { useSealMessage } from './useChatActions'

/**
 * Ответ прямо из ленты: письмо создаётся и запечатывается. Отправить его — отдельное решение
 * отправителя в блоке запечатанных писем над композером. Пустой текст кнопку выключает лишь как подсказку — настоящую проверку делает сервер.
 */
export function ChatComposer({ recipient }: { recipient: string }) {
  const { t } = useTranslation('chats')
  const [body, setBody] = useState('')
  const { mutate: seal, isPending, error, reset } = useSealMessage()

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (isPending || body.trim() === '') return
    seal({ recipient, body }, { onSuccess: () => setBody('') })
  }

  return (
    <form className={styles.composer} onSubmit={onSubmit}>
      <Textarea
        label={t('composer.label')}
        placeholder={t('composer.placeholder')}
        value={body}
        rows={4}
        // Успешное запечатывание очищает поле: правки, внесённые во время него, пропали бы.
        readOnly={isPending}
        onChange={(event) => {
          setBody(event.target.value)
          if (error) reset()
        }}
      />
      {error ? (
        <p className={styles.alert} role="alert">
          {errorMessage(error)}
        </p>
      ) : null}
      <div className={styles.composerActions}>
        <Button type="submit" disabled={isPending || body.trim() === ''}>
          {isPending ? t('composer.sealing') : t('composer.seal')}
        </Button>
        <p className={styles.hint}>{t('composer.hint')}</p>
      </div>
    </form>
  )
}
