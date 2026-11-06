import { useMutation, useQueryClient } from '@tanstack/react-query'

import { friendsApi } from '../../api'
import { friendsQueryKey } from './queryKeys'

/**
 * Ключ модуля писем: сервер при unfriend отменяет летящие письма пары, поэтому кэш
 * отправленных устаревает вместе со списком друзей. Модуль писем появится позже и
 * подхватит этот литерал как есть.
 */
const lettersQueryKey = ['letters'] as const

export function useUnfriend() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (username: string) => friendsApi.remove(username),
    // Сбрасываем и при отказе: если друга уже нет (not_found), списку всё равно пора обновиться.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: friendsQueryKey }),
        queryClient.invalidateQueries({ queryKey: lettersQueryKey }),
      ]),
  })
}
