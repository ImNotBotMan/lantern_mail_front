import { useQuery } from '@tanstack/react-query'

import { stampsApi } from '../../api'
import { stampsQueryKey } from './queryKeys'

/**
 * Коллекция марок с остатками. Время свежести не задаём: остаток — серверное состояние,
 * и диалог запечатывания спрашивает его заново при каждом открытии.
 */
export function useStamps() {
  return useQuery({ queryKey: stampsQueryKey, queryFn: () => stampsApi.list() })
}
