import { useQuery } from '@tanstack/react-query'

import { friendsApi } from '../../api'
import { friendsQueryKey } from './queryKeys'

/**
 * Список друзей. Сортировку по `username` делает сервер, клиент её не повторяет
 * (docs/specs/module-friends.md).
 */
export function useFriends() {
  return useQuery({
    queryKey: friendsQueryKey,
    queryFn: () => friendsApi.list(),
  })
}
