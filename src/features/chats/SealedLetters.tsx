import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '../../shared/i18n/apiError'
import { Button } from '../../shared/ui'
import { LetterView } from '../letters'
import styles from './chats.module.css'
import { useSealedFor, useSendSealed } from './useChatActions'

/**
 * Запечатанные письма собеседнику ждут отправки над композером. Отправка необратима, поэтому
 * сначала спрашивает подтверждение — как на экране письма.
 */
export function SealedLetters({ recipient }: { recipient: string }) {
  const { t } = useTranslation('chats')
  const sealed = useSealedFor(recipient)
  const { mutate: send, isPending, error, reset } = useSendSealed()
  const [confirming, setConfirming] = useState<string | null>(null)

  if (sealed.length === 0) return null

  return (
    <section className={styles.sealed} aria-label={t('sealed.title')}>
      <h2 className={styles.sealedTitle}>{t('sealed.title')}</h2>
      <ol className={styles.feed}>
        {sealed.map((letter) => (
          <li key={letter.id} className={styles.mine}>
            <LetterView letter={letter} />
            {confirming === letter.id ? (
              <div className={styles.composerActions}>
                <p className={styles.hint}>{t('sealed.confirm')}</p>
                <Button
                  disabled={isPending}
                  onClick={() => send(letter.id, { onSuccess: () => setConfirming(null) })}
                >
                  {isPending ? t('sealed.sending') : t('sealed.confirmYes')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={isPending}
                  onClick={() => {
                    setConfirming(null)
                    reset()
                  }}
                >
                  {t('common:actions.cancel')}
                </Button>
              </div>
            ) : (
              <div className={styles.composerActions}>
                <Button
                  disabled={isPending}
                  onClick={() => {
                    reset()
                    setConfirming(letter.id)
                  }}
                >
                  {t('sealed.send')}
                </Button>
              </div>
            )}
            {error && confirming === letter.id ? (
              <p className={styles.alert} role="alert">
                {errorMessage(error)}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
