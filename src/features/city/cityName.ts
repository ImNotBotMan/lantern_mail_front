import type { City } from '../../api/types'

/**
 * Название города на языке интерфейса. Справочник хранит два названия, а не одно,
 * поэтому перевод не нужен: выбираем готовую колонку.
 */
export function cityName(city: City, language: string): string {
  return language === 'en' ? city.name_en : city.name_ru
}

export function countryName(city: City, language: string): string {
  return language === 'en' ? city.country_en : city.country_ru
}
