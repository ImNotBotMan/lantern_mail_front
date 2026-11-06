import { useTranslation } from 'react-i18next'

import { FriendsList } from '../features/friends'

export function FriendsPage() {
  const { t } = useTranslation('friends')

  return (
    <div>
      <h1>{t('title')}</h1>
      <FriendsList />
    </div>
  )
}
