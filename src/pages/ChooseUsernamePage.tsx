import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { usersApi } from '../api'
import { ApiError } from '../api/errors'
import { pathAfterAuth, useSession } from '../features/session'
import { errorMessage } from '../shared/i18n/apiError'
import { Button, Field } from '../shared/ui'
import styles from './auth.module.css'

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/

/**
 * Шаг между входом через Google и продуктом: Firebase не знает нашего `username`.
 * Имя ставится один раз — по нему находят людей и адресуют письма.
 */
export function ChooseUsernamePage() {
  const { t } = useTranslation('auth')
  const { updateUser } = useSession()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [serverError, setServerError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(false)

  const usernameTaken = serverError?.code === 'username_taken'
  const alreadySet = serverError?.code === 'username_already_set'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const valid = USERNAME_PATTERN.test(username)

    setInvalid(!valid)
    setServerError(null)
    if (!valid) return

    setPending(true)
    try {
      updateUser(await usersApi.setUsername(username))
      // Дальше решают guard'ы: без города следующий шаг — `/city`
      navigate(pathAfterAuth(location.state), { replace: true })
    } catch (error) {
      setServerError(error instanceof ApiError ? error : null)
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <h1>{t('chooseUsername.title')}</h1>
      <p className={styles.note}>{t('chooseUsername.text')}</p>
      {serverError && !usernameTaken && !alreadySet ? (
        <p className={styles.alert} role="alert">
          {errorMessage(serverError)}
        </p>
      ) : null}
      <form className={styles.form} onSubmit={submit} noValidate>
        <Field
          label={t('register.username')}
          name="username"
          autoComplete="username"
          hint={t('register.usernameHint')}
          value={username}
          error={
            invalid
              ? t('validation.usernameFormat')
              : usernameTaken || alreadySet
                ? errorMessage(serverError)
                : undefined
          }
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
        />
        <Button className={styles.submit} type="submit" disabled={pending}>
          {t('chooseUsername.submit')}
        </Button>
      </form>
    </section>
  )
}
