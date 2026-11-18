import { useQuery } from '@tanstack/react-query'

import { countriesApi } from '../../api'
import { countriesQueryKey } from './queryKeys'

/** Страны меняются только миграцией бэкенда — кэш живёт долго. */
const COUNTRIES_STALE_TIME = 5 * 60 * 1000

/** Первый шаг выбора: страны, в которых есть города. */
export function useCountries() {
  return useQuery({
    queryKey: countriesQueryKey,
    queryFn: () => countriesApi.list(),
    staleTime: COUNTRIES_STALE_TIME,
  })
}
