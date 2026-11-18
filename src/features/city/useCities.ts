import { useQuery } from '@tanstack/react-query'

import { citiesApi } from '../../api'
import { citiesQueryKey } from './queryKeys'

/** Города меняются только миграцией бэкенда — кэш живёт долго. */
const CITIES_STALE_TIME = 5 * 60 * 1000

/**
 * Города одной страны (второй шаг выбора). Без выбранной страны запрос не запускается:
 * весь справочник больше не грузится целиком.
 */
export function useCities(country: string | null) {
  return useQuery({
    queryKey: citiesQueryKey(country),
    queryFn: () => citiesApi.list(country ?? undefined),
    staleTime: CITIES_STALE_TIME,
    enabled: country !== null,
  })
}
