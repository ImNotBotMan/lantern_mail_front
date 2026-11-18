/**
 * Корень кэша чатов. Realtime-событие и отправка сбрасывают его целиком: перезапрашиваются
 * только открытые на экране запросы — список и лента текущего диалога.
 */
export const chatsQueryKey = ['chats'] as const

export const conversationsQueryKey = [...chatsQueryKey, 'list'] as const

export const conversationFeedQueryKey = (id: string) => [...chatsQueryKey, 'feed', id] as const
