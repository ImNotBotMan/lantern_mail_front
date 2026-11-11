import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { usersApi } from '../api'
import { ApiError } from '../api/errors'
import { CityPicker } from '../features/city'
import { useSession } from '../features/session'
import { errorMessage } from '../shared/i18n/apiError'
import { Button } from '../shared/ui'
import styles from './city.module.css'

/**
 * Выбор города — отдельный шаг после регистрации и для пользователей без города.
 * Живёт под `AuthLayout`, но не под `GuestOnly`: это ещё не продукт, но уже не вход.
 */
export function CityPage() {
  const { t } = useTranslation('city')
  const navigate = useNavigate()
  const { user, updateUser } = useSession()

  const [selected, setSelected] = useState<number | null>(user?.city?.id ?? null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selected === null) return

    setPending(true)
    setError(null)
    try {
      updateUser(await usersApi.updateCity(selected))
      navigate('/inbox', { replace: true })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : null)
      setPending(false)
    }
  }

  return (
    <section>
      <h1>{t('title')}</h1>
      <form className={styles.form} onSubmit={submit}>
        <CityPicker value={selected} onChange={setSelected} disabled={pending} />

        {error ? (
          <p className={styles.alert} role="alert">
            {errorMessage(error)}
          </p>
        ) : null}

        <Button className={styles.submit} type="submit" disabled={pending || selected === null}>
          {t('submit')}
        </Button>
      </form>
    </section>
  )
}
