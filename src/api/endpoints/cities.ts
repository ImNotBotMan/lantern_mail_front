import { api } from '../client'
import type { City } from '../types'

export const citiesApi = {
  /** Справочник целиком, отсортированный по названию. Список мал — пагинации нет. */
  list(): Promise<City[]> {
    return api.request<City[]>('GET', '/cities')
  },
}
