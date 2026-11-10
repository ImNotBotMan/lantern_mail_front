import { useFriends } from '../friends'
import { useSession } from '../session'

/**
 * Кому можно писать: взаимные друзья и сам автор («письмо в будущее»). Право всё равно
 * проверяет сервер (`not_friends`, 409) — список только предлагает варианты
 * (docs/specs/module-front-letters.md).
 */
export function useRecipients() {
  const friends = useFriends()
  const { user } = useSession()

  const self = user?.username ?? null
  const options = (friends.data ?? []).map((friend) => friend.username)
  if (self && !options.includes(self)) options.push(self)

  return {
    options,
    self,
    isPending: friends.isPending,
    isError: friends.isError,
    error: friends.error,
    refetch: friends.refetch,
  }
}
