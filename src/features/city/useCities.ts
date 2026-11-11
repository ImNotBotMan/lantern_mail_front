import { useQuery } from '@tanstack/react-query'

import { citiesApi } from '../../api'
import { citiesQueryKey } from './queryKeys'

/** Справочник городов меняется только миграцией бэкенда — кэш живёт долго. */
const CITIES_STALE_TIME = 5 * 60 * 1000

export function useCities() {
  return useQuery({
    queryKey: citiesQueryKey,
    queryFn: () => citiesApi.list(),
    staleTime: CITIES_STALE_TIME,
  })
}
