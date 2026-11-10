import { useMutation, useQueryClient } from '@tanstack/react-query'

import { lettersApi } from '../../api'
import type { LetterCreate, LetterUpdate } from '../../api'
import { lettersQueryKey } from './queryKeys'

/**
 * Любое действие меняет статус письма, а статус виден и в отправленных, и на экране письма.
 * Поэтому сбрасываем весь корень `['letters']`, а не отдельный ключ.
 */
function useLetterMutation<TData, TVariables>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: lettersQueryKey }),
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

/** Запечатывание без обёртки: каталога печатей и марок пока нет. */
export function useSealLetter() {
  return useLetterMutation((id: string) => lettersApi.seal(id))
}

export function useUnsealLetter() {
  return useLetterMutation((id: string) => lettersApi.unseal(id))
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
