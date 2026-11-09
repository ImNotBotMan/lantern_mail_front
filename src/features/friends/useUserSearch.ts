import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { usersApi } from '../../api'
import { friendsQueryKey } from './queryKeys'

/** Минимум, с которого сервер отвечает на поиск: короче — 422 (docs/specs/module-friends.md). */
export const SEARCH_MIN_LENGTH = 3

/** Те же символы, что в регистрации имени. */
const USERNAME_PATTERN = /^[a-z0-9_]+$/

const SEARCH_DEBOUNCE_MS = 300

export type SearchInputState = 'idle' | 'tooShort' | 'invalid' | 'ready'

/**
 * Нормализует ввод к виду, в котором сервер ищет: нижний регистр, разрешены `[a-z0-9_]`.
 * Пустой ввод — `idle`, короткий — `tooShort`, с недопустимыми символами — `invalid`.
 */
export function normalizeSearchInput(raw: string): { value: string; state: SearchInputState } {
  const value = raw.trim().toLowerCase()
  if (value === '') return { value: '', state: 'idle' }
  if (value.length < SEARCH_MIN_LENGTH) return { value, state: 'tooShort' }
  if (!USERNAME_PATTERN.test(value)) return { value, state: 'invalid' }
  return { value, state: 'ready' }
}

/**
 * Поиск пользователей по началу имени. Запрос уходит с задержкой после ввода, только
 * когда ввод достаточно длинный и валидный. Живёт в кэше друзей: мутации заявки сбрасывают
 * корень `['friends']`, и результаты поиска перечитываются вместе со списками.
 */
export function useUserSearch(rawInput: string) {
  const { value, state } = normalizeSearchInput(rawInput)

  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value])

  // Запрос уходит только когда дебаунс догнал ввод и ввод валиден: иначе по короткому
  // «отсталому» значению ушёл бы 422 вместо ожидания (docs/specs/module-friends.md).
  const ready = normalizeSearchInput(debounced).state === 'ready'

  return {
    state,
    query: useQuery({
      queryKey: [...friendsQueryKey, 'search', debounced] as const,
      queryFn: ({ signal }) => usersApi.search(debounced, signal),
      enabled: ready,
      // Пока пользователь печатает дальше, показываем прошлый результат, а не мигание загрузки.
      placeholderData: keepPreviousData,
    }),
  }
}
