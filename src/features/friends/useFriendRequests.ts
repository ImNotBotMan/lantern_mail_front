import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { friendsApi } from '../../api'
import { friendsQueryKey } from './queryKeys'

/**
 * Заявки ко мне. Сортировку «сначала новые» делает сервер, клиент её не повторяет
 * (docs/specs/module-friends.md).
 */
export function useIncomingRequests() {
  return useQuery({
    queryKey: [...friendsQueryKey, 'requests', 'incoming'] as const,
    queryFn: () => friendsApi.incoming(),
  })
}

/** Мои исходящие заявки. */
export function useOutgoingRequests() {
  return useQuery({
    queryKey: [...friendsQueryKey, 'requests', 'outgoing'] as const,
    queryFn: () => friendsApi.outgoing(),
  })
}

/**
 * Все действия с заявками меняют одну и ту же пару «друзья ↔ заявки», поэтому любая
 * из них сбрасывает корень кэша `['friends']` — вместе с поиском и обеими секциями.
 */
function useFriendRequestMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: friendsQueryKey }),
  })
}

export function useSendFriendRequest() {
  return useFriendRequestMutation((recipientUsername: string) =>
    friendsApi.sendRequest(recipientUsername),
  )
}

export function useAcceptFriendRequest() {
  return useFriendRequestMutation((requestId: string) => friendsApi.accept(requestId))
}

export function useDeclineFriendRequest() {
  return useFriendRequestMutation((requestId: string) => friendsApi.decline(requestId))
}

export function useWithdrawFriendRequest() {
  return useFriendRequestMutation((requestId: string) => friendsApi.withdraw(requestId))
}
