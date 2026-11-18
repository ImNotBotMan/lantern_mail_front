import { api } from '../client'
import type { City } from '../types'

export const citiesApi = {
  /**
   * Города справочника, отсортированные по названию. С фильтром по стране — города
   * одной страны (шаг «город» после выбора страны), без — весь справочник.
   */
  list(country?: string): Promise<City[]> {
    const query = country ? `?country=${encodeURIComponent(country)}` : ''
    return api.request<City[]>('GET', `/cities${query}`)
  },
}
