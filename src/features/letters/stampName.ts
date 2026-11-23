import type { Stamp } from '../../api/types'

/**
 * Название марки на языке интерфейса. Каталог хранит два названия, а не одно,
 * поэтому перевод не нужен: выбираем готовую колонку (как `cityName`).
 */
export function stampName(stamp: Stamp, language: string): string {
  return language === 'en' ? stamp.name_en : stamp.name_ru
}
