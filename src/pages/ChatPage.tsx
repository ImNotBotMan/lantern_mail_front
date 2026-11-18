import { useParams } from 'react-router-dom'

import { ChatFeed } from '../features/chats'

export function ChatPage() {
  const { id = '' } = useParams()

  // Ключ по id: лента и композер другого диалога не наследуют состояние предыдущего.
  return <ChatFeed key={id} id={id} />
}
