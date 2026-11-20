import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Textarea } from '../../shared/ui'
import { SealLetterDialog } from '../letters/SealLetterDialog'
import styles from './chats.module.css'
import { useSealMessage } from './useChatActions'

/**
 * Ответ прямо из ленты: письмо создаётся и запечатывается. Марка выбирается в том же диалоге,
 * что и на экране письма; отправка — отдельное решение отправителя в блоке запечатанных писем
 * над композером. Пустой текст кнопку выключает лишь как подсказку — настоящую проверку делает
 * сервер.
 */
export function ChatComposer({ recipient }: { recipient: string }) {
  const { t } = useTranslation('chats')
  const [body, setBody] = useState('')
  const [picking, setPicking] = useState(false)
  const { mutateAsync: seal } = useSealMessage()

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (body.trim() === '') return
    setPicking(true)
  }

  /** Ошибка запечатывания остаётся в диалоге: он не закрывается, выбор марки не теряется. */
  async function sealWith(stampId: number | null) {
    await seal({ recipient, body, stampId })
    setBody('')
    setPicking(false)
  }

  return (
    <>
      <form className={styles.composer} onSubmit={onSubmit}>
        <Textarea
          label={t('composer.label')}
          placeholder={t('composer.placeholder')}
          value={body}
          rows={4}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className={styles.composerActions}>
          <Button type="submit" disabled={body.trim() === ''}>
            {t('composer.seal')}
          </Button>
          <p className={styles.hint}>{t('composer.hint')}</p>
        </div>
      </form>

      {picking ? <SealLetterDialog onSeal={sealWith} onClose={() => setPicking(false)} /> : null}
    </>
  )
}
