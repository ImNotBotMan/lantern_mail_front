import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '../../shared/i18n/apiError'
import { Button, ErrorState, Spinner } from '../../shared/ui'
import { cityName, countryLabel } from './cityName'
import styles from './CityPicker.module.css'
import { useCities } from './useCities'
import { useCountries } from './useCountries'

interface CityPickerProps {
  value: number | null
  /** null — выбор сброшен (пользователь вернулся к другой стране). */
  onChange: (cityId: number | null) => void
  disabled?: boolean
  /**
   * Код страны текущего города: с ним второй шаг открывается сразу, минуя выбор страны.
   * Для нового пользователя ничего не передаётся — выбор начинается со списка стран.
   */
  initialCountryCode?: string | null
}

/**
 * Двухшаговый выбор: сначала страна, затем город внутри неё с поиском. Справочник большой
 * (сотни городов), поэтому грузится только выбранная страна. Наружу пикер не меняется:
 * выбирается один город, `city_id` уходит как раньше.
 */
export function CityPicker({ value, onChange, disabled, initialCountryCode }: CityPickerProps) {
  const { t, i18n } = useTranslation('city')
  const [country, setCountry] = useState<string | null>(initialCountryCode ?? null)
  const [search, setSearch] = useState('')

  const countries = useCountries()
  const cities = useCities(country)

  const language = i18n.language
  const sortedCountries = useMemo(() => {
    if (!countries.data) return []
    return [...countries.data].sort((a, b) =>
      countryLabel(a, language).localeCompare(countryLabel(b, language), language),
    )
  }, [countries.data, language])

  const filteredCities = useMemo(() => {
    if (!cities.data) return []
    const query = search.trim().toLowerCase()
    if (!query) return cities.data
    return cities.data.filter((city) => cityName(city, language).toLowerCase().includes(query))
  }, [cities.data, search, language])

  /** Смена страны сбрасывает выбранный город: он мог принадлежать прошлой стране. */
  function chooseCountry(code: string | null) {
    setCountry(code)
    setSearch('')
    if (value !== null) onChange(null)
  }

  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend className={styles.legend}>{t('label')}</legend>

      {country === null ? (
        <>
          <p className={styles.hint}>{t('countryHint')}</p>

          {countries.isPending ? <Spinner /> : null}

          {countries.isError ? (
            <ErrorState
              message={errorMessage(countries.error)}
              onRetry={() => void countries.refetch()}
            />
          ) : null}

          {sortedCountries.length > 0 ? (
            <div className={styles.list}>
              {sortedCountries.map((item) => (
                <button
                  key={item.country_code}
                  type="button"
                  className={styles.option}
                  disabled={disabled}
                  onClick={() => chooseCountry(item.country_code)}
                >
                  <span className={styles.optionMain}>
                    <span className={styles.optionName}>{countryLabel(item, language)}</span>
                    <span className={styles.optionCountry}>
                      {t('citiesCount', { count: item.city_count })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className={styles.hint}>{t('hint')}</p>

          <div className={styles.cityStepHead}>
            <Button
              variant="secondary"
              className={styles.backButton}
              onClick={() => chooseCountry(null)}
              type="button"
            >
              {t('backToCountries')}
            </Button>
            <input
              type="search"
              className={styles.search}
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {cities.isPending ? <Spinner /> : null}

          {cities.isError ? (
            <ErrorState
              message={errorMessage(cities.error)}
              onRetry={() => void cities.refetch()}
            />
          ) : null}

          {filteredCities.length > 0 ? (
            <div className={styles.list}>
              {filteredCities.map((city) => (
                <label
                  key={city.id}
                  className={
                    value === city.id ? `${styles.option} ${styles.optionActive}` : styles.option
                  }
                >
                  <input
                    type="radio"
                    name="city"
                    className={styles.optionInput}
                    value={city.id}
                    checked={value === city.id}
                    disabled={disabled}
                    onChange={() => onChange(city.id)}
                  />
                  <span className={styles.optionMain}>
                    <span className={styles.optionName}>{cityName(city, language)}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : cities.data ? (
            <p className={styles.noMatches}>{t('noMatches')}</p>
          ) : null}
        </>
      )}
    </fieldset>
  )
}
