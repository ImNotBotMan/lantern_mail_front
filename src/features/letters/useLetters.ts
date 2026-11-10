import { useQuery } from '@tanstack/react-query'

import { lettersApi } from '../../api'
import { inboxLettersQueryKey, letterQueryKey, sentLettersQueryKey } from './queryKeys'

/** Отправленные. Порядок и статусы приходят с сервера — клиент их не вычисляет. */
export function useSentLetters() {
  return useQuery({
    queryKey: sentLettersQueryKey,
    queryFn: () => lettersApi.sent(),
  })
}

/** Входящие: конверты в пути и доставленные письма. Порядок задаёт сервер. */
export function useInboxLetters() {
  return useQuery({
    queryKey: inboxLettersQueryKey,
    queryFn: () => lettersApi.inbox(),
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
  })
}
