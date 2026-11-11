import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { usersApi } from '../api'
import { CityPicker, cityName } from '../features/city'
import { useSession } from '../features/session'
import { errorMessage } from '../shared/i18n/apiError'
import { formatDate } from '../shared/i18n/formatDate'
import { Button } from '../shared/ui'
import styles from './AccountPage.module.css'

/** Лимит смены города — 7 дней с последней смены, а не календарная неделя. */
const CITY_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

/** Дата, с которой город можно сменить; null — город ещё не выбирался. */
function cityChangeDate(cityChangedAt: string | null): Date | null {
  if (!cityChangedAt) return null
  return new Date(new Date(cityChangedAt).getTime() + CITY_CHANGE_COOLDOWN_MS)
}

export function AccountPage() {
  const { t, i18n } = useTranslation(['auth', 'city', 'common'])
  const { user, logout, logoutAll, updateUser } = useSession()

  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const [editingCity, setEditingCity] = useState(false)
  const [selectedCity, setSelectedCity] = useState<number | null>(null)
  const [savingCity, setSavingCity] = useState(false)
  const [cityError, setCityError] = useState<unknown>(null)
  // Момент открытия экрана: лимит смены города считается от него, а не от каждого рендера
  const [openedAt] = useState(() => Date.now())

  if (!user) return null

  const createdAt = formatDate(user.created_at, i18n.language)
  const changeFrom = cityChangeDate(user.city_changed_at)

  async function handleLogout() {
    setPending(true)
    // Guard уводит на вход, как только сессия стала анонимной.
    await logout()
  }

  async function handleLogoutAll() {
    setPending(true)
    setError(null)
    try {
      await logoutAll()
    } catch (cause) {
      setError(cause)
      setPending(false)
    }
  }

  async function handleCitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedCity === null) return

    setSavingCity(true)
    setCityError(null)
    try {
      updateUser(await usersApi.updateCity(selectedCity))
      setEditingCity(false)
    } catch (cause) {
      setCityError(cause)
    } finally {
      setSavingCity(false)
    }
  }

  const startEditingCity = () => {
    setSelectedCity(user.city?.id ?? null)
    setCityError(null)
    setEditingCity(true)
  }

  return (
    <section>
      <h1>{t('account.title')}</h1>
      <dl className={styles.facts}>
        <dt>{t('account.username')}</dt>
        <dd>{user.username ?? user.id}</dd>
        <dt>{t('account.createdAt')}</dt>
        <dd>{createdAt}</dd>
      </dl>

      <section className={styles.citySection}>
        <h2 className={styles.sectionTitle}>{t('city:current')}</h2>
        <p className={styles.cityName}>
          {user.city ? cityName(user.city, i18n.language) : t('city:none')}
        </p>

        {editingCity ? (
          <form className={styles.cityForm} onSubmit={handleCitySubmit}>
            <CityPicker value={selectedCity} onChange={setSelectedCity} disabled={savingCity} />
            {cityError ? (
              <p className={styles.alert} role="alert">
                {errorMessage(cityError)}
              </p>
            ) : null}
            <div className={styles.confirmActions}>
              <Button type="submit" disabled={savingCity || selectedCity === null}>
                {t('city:submit')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditingCity(false)}
                disabled={savingCity}
              >
                {t('common:actions.cancel')}
              </Button>
            </div>
          </form>
        ) : changeFrom === null || openedAt >= changeFrom.getTime() ? (
          <Button variant="secondary" onClick={startEditingCity}>
            {t('city:change')}
          </Button>
        ) : (
          <p className={styles.cityLimit}>
            {t('city:changeLimit', { date: formatDate(changeFrom.toISOString(), i18n.language) })}
          </p>
        )}
      </section>

      {error ? (
        <p className={styles.alert} role="alert">
          {errorMessage(error)}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={handleLogout} disabled={pending}>
          {t('account.logout')}
        </Button>

        {confirmingLogoutAll ? (
          <div className={styles.confirm}>
            <p>{t('account.logoutAllQuestion')}</p>
            <div className={styles.confirmActions}>
              <Button variant="danger" onClick={handleLogoutAll} disabled={pending}>
                {t('account.logoutAllConfirm')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmingLogoutAll(false)}
                disabled={pending}
              >
                {t('common:actions.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmingLogoutAll(true)} disabled={pending}>
            {t('account.logoutAll')}
          </Button>
        )}
      </div>
    </section>
  )
}
