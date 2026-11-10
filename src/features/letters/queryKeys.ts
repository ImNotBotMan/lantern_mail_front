/**
 * Корень кэша писем. `useUnfriend` сбрасывает его литералом `['letters']` (сервер отменяет
 * летящие письма пары), поэтому обе стороны держат одно и то же имя.
 */
export const lettersQueryKey = ['letters'] as const

/** Отправленные: черновики, запечатанные, в пути, отменённые. */
export const sentLettersQueryKey = [...lettersQueryKey, 'sent'] as const

/** Письмо по id — отдельно от списков, чтобы экран письма не тянул весь список. */
export const letterQueryKey = (id: string) => [...lettersQueryKey, 'letter', id] as const
