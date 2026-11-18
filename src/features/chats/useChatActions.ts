import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { ApiError, lettersApi } from '../../api'
import type { AnyLetter, LetterResponse } from '../../api'
import { lettersQueryKey } from '../letters/queryKeys'
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
 * Довозит письмо до отправки с того шага, где остановилась прошлая попытка. Следующий шаг
 * выбирается по `status` из последнего ответа сервера, а не угадывается.
 */
async function deliver(
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
    // Текст поправили после неудачной попытки: письмо уходит с новым текстом.
    letter = unfinished
    if (letter.status === 'sealed') letter = remember(await lettersApi.unseal(letter.id))
    letter = remember(await lettersApi.update(letter.id, { body: message.body }))
  } else {
    letter = unfinished
  }

  if (letter.status === 'draft') letter = remember(await lettersApi.seal(letter.id))
  return lettersApi.send(letter.id)
}

/**
 * Отправка из композера одним действием: создать → запечатать → отправить. Если шаг упал
 * (например, обрыв связи), повтор продолжает то же письмо, а не плодит черновики в отправленных.
 */
export function useSendMessage() {
  const invalidate = useInvalidateLetters()
  const [unfinished, setUnfinished] = useState<LetterResponse | null>(null)

  return useMutation({
    mutationFn: (message: ChatMessage) => {
      const resumable = unfinished?.recipient_username === message.recipient ? unfinished : null
      return deliver(message, resumable, (letter) => {
        setUnfinished(letter)
        return letter
      })
    },
    onSuccess: () => setUnfinished(null),
    onError: (error) => {
      // Сервер считает, что письмо уже ушло дальше, чем мы знаем: продолжать его вслепую нельзя.
      if (error instanceof ApiError && error.code === 'invalid_state') setUnfinished(null)
    },
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
