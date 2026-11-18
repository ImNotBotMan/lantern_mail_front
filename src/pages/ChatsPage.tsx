import { useTranslation } from 'react-i18next'

import { ChatList } from '../features/chats'

export function ChatsPage() {
  const { t } = useTranslation('chats')

  return (
    <section>
      <h1>{t('list.title')}</h1>
      <ChatList />
    </section>
  )
}
