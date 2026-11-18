import { api, socketUrl } from '../client'
import type { ConversationFeed, ConversationFeedQuery, ConversationList } from '../types'

export const conversationsApi = {
  list(): Promise<ConversationList> {
    return api.request<ConversationList>('GET', '/conversations')
  },

  /** `before` — непрозрачный курсор из прошлой страницы, передаётся обратно как есть. */
  letters(id: string, { limit, before }: ConversationFeedQuery = {}): Promise<ConversationFeed> {
    const query = new URLSearchParams()
    if (limit !== undefined) query.set('limit', String(limit))
    if (before) query.set('before', before)
    const search = query.toString()
    const path = `/conversations/${encodeURIComponent(id)}/letters`
    return api.request<ConversationFeed>('GET', search ? `${path}?${search}` : path)
  },

  /** Адрес realtime-шины: браузерный WebSocket не шлёт заголовков, токен идёт в query. */
  eventsUrl(accessToken: string): string {
    return socketUrl('/ws', { token: accessToken })
  },
}
