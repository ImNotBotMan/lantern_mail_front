import type { Location } from 'react-router-dom'

interface AuthLocationState {
  from?: Location
}

/**
 * Куда вернуть пользователя после входа и регистрации: сохранённый guard'ом адрес или
 * входящие (docs/specs/module-session.md, «Возврат на исходный экран»).
 */
export function pathAfterAuth(state: unknown): string {
  const from = (state as AuthLocationState | null)?.from
  if (!from) return '/inbox'
  return `${from.pathname}${from.search}${from.hash}`
}
