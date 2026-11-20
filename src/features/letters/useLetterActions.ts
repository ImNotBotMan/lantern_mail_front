import { useMutation, useQueryClient } from '@tanstack/react-query'

import { lettersApi } from '../../api'
import type { LetterCreate, LetterUpdate } from '../../api'
import { lettersQueryKey, stampsQueryKey } from './queryKeys'

/**
 * Любое действие меняет статус письма, а статус виден и в отправленных, и на экране письма.
 * Поэтому сбрасываем весь корень `['letters']`, а не отдельный ключ. Запечатывание и
 * распечатка трогают ещё и коллекцию марок — с ней сбрасывается и она.
 */
function useLetterMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  withStamps = false,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: lettersQueryKey }),
        withStamps ? queryClient.invalidateQueries({ queryKey: stampsQueryKey }) : null,
      ]),
  })
}

export function useCreateLetter() {
  return useLetterMutation((data: LetterCreate) => lettersApi.create(data))
}

export function useUpdateLetter() {
  return useLetterMutation(({ id, data }: { id: string; data: LetterUpdate }) =>
    lettersApi.update(id, data),
  )
}

export interface SealLetterVariables {
  id: string
  /** `null` — «без марки»: поле не уходит вовсе. Марка списывает сервер. */
  stampId: number | null
}

/** Запечатывание с маркой или без неё одним запросом: `stamp_id` — часть тела. */
export function useSealLetter() {
  return useLetterMutation(
    ({ id, stampId }: SealLetterVariables) =>
      lettersApi.seal(id, { stamp_id: stampId ?? undefined }),
    true,
  )
}

/** Распечатка возвращает марку в коллекцию — сбрасываем и её. */
export function useUnsealLetter() {
  return useLetterMutation((id: string) => lettersApi.unseal(id), true)
}

export function useSendLetter() {
  return useLetterMutation((id: string) => lettersApi.send(id))
}

/** Прочтение: доставленное письмо становится прочитанным в момент открытия. */
export function useReadLetter() {
  return useLetterMutation((id: string) => lettersApi.read(id))
}

export function useDeleteLetter() {
  return useLetterMutation((id: string) => lettersApi.remove(id))
}
