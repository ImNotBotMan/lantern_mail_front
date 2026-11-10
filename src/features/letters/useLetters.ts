import { useQuery } from '@tanstack/react-query'

import { lettersApi } from '../../api'
import { inboxLettersQueryKey, letterQueryKey, sentLettersQueryKey } from './queryKeys'

/**
 * Письмо меняет статус само, по часам: конверт становится письмом, а доставленное —
 * прочитанным. Поэтому списки и письмо не кэшируются по времени (в отличие от друзей):
 * вход на экран всегда спрашивает сервер, а свежесть без реалтайма — из спеки модуля.
 */
const ALWAYS_STALE = 0

/** Отправленные. Порядок и статусы приходят с сервера — клиент их не вычисляет. */
export function useSentLetters() {
  return useQuery({
    queryKey: sentLettersQueryKey,
    queryFn: () => lettersApi.sent(),
    staleTime: ALWAYS_STALE,
  })
}

/** Входящие: конверты в пути и доставленные письма. Порядок задаёт сервер. */
export function useInboxLetters() {
  return useQuery({
    queryKey: inboxLettersQueryKey,
    queryFn: () => lettersApi.inbox(),
    staleTime: ALWAYS_STALE,
  })
}

/**
 * Письмо по id. Какую форму показывать, решает поле `view` в ответе, а не догадка клиента
 * (docs/specs/module-front-letters.md).
 */
export function useLetter(id: string) {
  return useQuery({
    queryKey: letterQueryKey(id),
    queryFn: () => lettersApi.get(id),
    enabled: id !== '',
    staleTime: ALWAYS_STALE,
  })
}
