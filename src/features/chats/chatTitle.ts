import type { TFunction } from 'i18next'

import type { ConversationSummary } from '../../api'

/** Название диалога: у чата «Себе» собеседника нет, у остальных — его имя с сервера. */
export function chatTitle(conversation: ConversationSummary, t: TFunction): string {
  if (conversation.is_self) return t('chats:chat.self')
  return conversation.peer_username ?? t('chats:chat.unknownPeer')
}
