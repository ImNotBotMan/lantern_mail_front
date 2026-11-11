import { useTranslation } from 'react-i18next'

import { errorMessage } from '../../shared/i18n/apiError'
import { ErrorState, Spinner } from '../../shared/ui'
import { cityName, countryName } from './cityName'
import styles from './CityPicker.module.css'
import { useCities } from './useCities'

interface CityPickerProps {
  value: number | null
  onChange: (cityId: number) => void
  disabled?: boolean
}

/**
 * Выбор города из справочника. Список мал, поэтому показывается целиком, без поиска и
 * пагинации. Название берётся на языке интерфейса из двух колонок города.
 */
export function CityPicker({ value, onChange, disabled }: CityPickerProps) {
  const { t, i18n } = useTranslation('city')
  const { data, isPending, isError, error, refetch } = useCities()

  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend className={styles.legend}>{t('label')}</legend>
      <p className={styles.hint}>{t('hint')}</p>

      {isPending ? <Spinner /> : null}

      {isError ? <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} /> : null}

      {data && data.length > 0 ? (
        <div className={styles.list}>
          {data.map((city) => (
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
                <span className={styles.optionName}>{cityName(city, i18n.language)}</span>
                <span className={styles.optionCountry}>{countryName(city, i18n.language)}</span>
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </fieldset>
  )
}
