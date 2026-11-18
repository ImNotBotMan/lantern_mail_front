import { api } from '../client'
import type { Country } from '../types'

/** Страны, в которых есть города в справочнике. */
export const countriesApi = {
  list(): Promise<Country[]> {
    return api.request<Country[]>('GET', '/countries')
  },
}
