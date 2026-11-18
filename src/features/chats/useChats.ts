import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { conversationsApi } from '../../api'
import { conversationFeedQueryKey, conversationsQueryKey } from './queryKeys'

/** Статус писем в чате меняется по часам, как и во входящих, — вход на экран спрашивает сервер. */
const ALWAYS_STALE = 0

export const FEED_PAGE_SIZE = 50

/** Список диалогов. Порядок задаёт сервер («Себе» — в конце), клиент не пересортировывает. */
export function useConversations() {
  return useQuery({
    queryKey: conversationsQueryKey,
    queryFn: () => conversationsApi.list(),
    select: (data) => data.items,
    staleTime: ALWAYS_STALE,
  })
}

/** Лента диалога страницами по курсору `before`; страницы идут от новых писем к ранним. */
export function useConversationFeed(id: string) {
  return useInfiniteQuery({
    queryKey: conversationFeedQueryKey(id),
    queryFn: ({ pageParam }) =>
      conversationsApi.letters(id, { limit: FEED_PAGE_SIZE, before: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    enabled: id !== '',
    staleTime: ALWAYS_STALE,
  })
}
