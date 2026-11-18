import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { LetterEvent } from '../../api'
import { lettersQueryKey } from '../letters/queryKeys'
import { chatsQueryKey, conversationFeedQueryKey, conversationsQueryKey } from './queryKeys'
import { connectChatEvents } from './ws'

/**
 * Realtime для открытого приложения: событие письма лишь говорит, что кэш устарел, а данные
 * приходят обычными GET'ами. Поэтому повтор события безвреден.
 *
 * Событие всегда несёт `conversation_id`, поэтому обновляется один чат: список и его лента.
 * Событий без id не бывает — их отбрасывает `ws.ts`.
 */
export function useChatEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const refresh = (event: LetterEvent) => {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey })
      void queryClient.invalidateQueries({
        queryKey: conversationFeedQueryKey(event.conversation_id),
      })
      void queryClient.invalidateQueries({ queryKey: lettersQueryKey })
    }
    // Без события — догон после обрыва: что пропущено, неизвестно, спрашиваем всё.
    const refreshAll = () => {
      void queryClient.invalidateQueries({ queryKey: chatsQueryKey })
      void queryClient.invalidateQueries({ queryKey: lettersQueryKey })
    }

    return connectChatEvents({ onEvent: refresh, onReconnected: refreshAll })
  }, [queryClient])
}
