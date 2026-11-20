import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { ApiError, lettersApi } from '../../api'
import type { AnyLetter, LetterResponse } from '../../api'
import { lettersQueryKey } from '../letters/queryKeys'
import { useSentLetters } from '../letters/useLetters'
import { chatsQueryKey } from './queryKeys'

/** Письмо из чата видно и в ленте, и во входящих/отправленных — сбрасываем оба корня. */
function useInvalidateLetters() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: chatsQueryKey }),
      queryClient.invalidateQueries({ queryKey: lettersQueryKey }),
    ])
}

export interface ChatMessage {
  recipient: string
  body: string
}

/**
 * Довозит письмо до запечатывания с того шага, где остановилась прошлая попытка. Следующий
 * шаг выбирается по `status` из последнего ответа сервера, а не угадывается.
 */
async function seal(
  message: ChatMessage,
  unfinished: LetterResponse | null,
  remember: (letter: LetterResponse) => LetterResponse,
): Promise<LetterResponse> {
  let letter: LetterResponse
  if (!unfinished) {
    letter = remember(
      await lettersApi.create({ recipient_username: message.recipient, body: message.body }),
    )
  } else if (unfinished.body !== message.body) {
    // Текст поправили после неудачной попытки: запечатываем уже новый текст.
    letter = remember(await lettersApi.update(unfinished.id, { body: message.body }))
  } else {
    letter = unfinished
  }

  return lettersApi.seal(letter.id)
}

/**
 * Запечатывание из композера: создать → запечатать. Отправка — отдельный шаг отправителя
 * (docs/letter-lifecycle.md), её делает `SealedLetters`. Если шаг упал, повтор продолжает
 * тот же черновик, а не плодит новые в отправленных.
 */
export function useSealMessage() {
  const invalidate = useInvalidateLetters()
  const [unfinished, setUnfinished] = useState<LetterResponse | null>(null)

  return useMutation({
    mutationFn: (message: ChatMessage) => {
      const resumable = unfinished?.recipient_username === message.recipient ? unfinished : null
      return seal(message, resumable, (letter) => {
        setUnfinished(letter)
        return letter
      })
    },
    onSuccess: () => setUnfinished(null),
    onError: (error) => {
      // Сервер считает, что черновик уже не черновик: продолжать его вслепую нельзя.
      if (error instanceof ApiError && error.code === 'invalid_state') setUnfinished(null)
    },
    onSettled: invalidate,
  })
}

/** Запечатанные письма собеседнику: в ленту чата они не попадают, ждут отправки здесь. */
export function useSealedFor(recipient: string) {
  const { data } = useSentLetters()
  return (data ?? []).filter(
    (letter) => letter.status === 'sealed' && letter.recipient_username === recipient,
  )
}

/** Отправленное письмо появляется в ленте чата — сбрасываем и чаты, и письма. */
export function useSendSealed() {
  const invalidate = useInvalidateLetters()
  return useMutation({
    mutationFn: (id: string) => lettersApi.send(id),
    onSettled: invalidate,
  })
}

/**
 * Показ доставленного письма в ленте — это его открытие: `POST /read` один раз на письмо,
 * как на экране письма (docs/specs/module-letters.md).
 */
export function useReadOnShow(letters: AnyLetter[]) {
  const invalidate = useInvalidateLetters()
  const requested = useRef(new Set<string>())
  const { mutate: markRead } = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => lettersApi.read(id))),
    onSettled: invalidate,
  })

  useEffect(() => {
    const ids = letters
      .filter((letter) => letter.view === 'incoming' && letter.status === 'delivered')
      .map((letter) => letter.id)
      .filter((id) => !requested.current.has(id))
    if (ids.length === 0) return
    for (const id of ids) requested.current.add(id)
    markRead(ids)
  }, [letters, markRead])
}
