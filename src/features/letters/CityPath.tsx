import { useTranslation } from 'react-i18next'

import type { City } from '../../api/types'
import { cityName } from '../city'
import styles from './letters.module.css'

interface CityPathProps {
  senderCity: City | null
  recipientCity: City | null
}

/**
 * Путь письма: «летит из Москвы в Санкт-Петербург». Снимок городов приходит с сервера,
 * поэтому смена города после отправки путь уже летящего письма не переписывает.
 * Если города нет — строки нет: экран не досочиняет.
 */
export function CityPath({ senderCity, recipientCity }: CityPathProps) {
  const { t, i18n } = useTranslation('letters')
  if (!senderCity || !recipientCity) return null

  return (
    <p className={styles.path}>
      {t('letter.path', {
        from: cityName(senderCity, i18n.language),
        to: cityName(recipientCity, i18n.language),
      })}
    </p>
  )
}
