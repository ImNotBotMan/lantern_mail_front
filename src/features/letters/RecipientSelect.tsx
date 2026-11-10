import { useTranslation } from 'react-i18next'

import { errorMessage } from '../../shared/i18n/apiError'
import { ErrorState, LinkButton, Spinner } from '../../shared/ui'
import styles from './letters.module.css'
import { lettersPaths } from './paths'
import { useRecipients } from './useRecipients'

interface RecipientSelectProps {
  value: string
  onChange: (username: string) => void
  disabled?: boolean
}

/**
 * Получатель выбирается из готового списка, а не вводится текстом: писать можно только
 * взаимным друзьям и самому себе. Право всё равно проверяет сервер.
 */
export function RecipientSelect({ value, onChange, disabled }: RecipientSelectProps) {
  const { t } = useTranslation('letters')
  const { options, self, isPending, isError, error, refetch } = useRecipients()

  return (
    <fieldset className={styles.recipients}>
      <legend className={styles.legend}>{t('editor.recipient')}</legend>
      <p className={styles.hint}>{t('editor.recipientHint')}</p>

      {isPending ? <Spinner /> : null}

      {isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : null}

      {!isPending && !isError && options.length === 0 ? (
        <div className={styles.noRecipients}>
          <p>{t('editor.noFriends')}</p>
          <LinkButton to={lettersPaths.friends}>{t('editor.goToFriends')}</LinkButton>
        </div>
      ) : null}

      {options.length > 0 ? (
        <div className={styles.chips}>
          {options.map((username) => (
            <label
              key={username}
              className={value === username ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            >
              <input
                type="radio"
                name="recipient"
                className={styles.chipInput}
                value={username}
                checked={value === username}
                disabled={disabled}
                onChange={() => onChange(username)}
              />
              <span>
                {username === self
                  ? t('editor.selfOption', { username: `@${username}` })
                  : `@${username}`}
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </fieldset>
  )
}
