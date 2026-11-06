import { Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'

import { AppLayout } from './layout/AppLayout'
import { FriendsPage } from '../pages/FriendsPage'
import { InboxPage } from '../pages/InboxPage'
import { LetterEditorPage } from '../pages/LetterEditorPage'
import { LetterPage } from '../pages/LetterPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { RegisterPage } from '../pages/RegisterPage'
import { SentPage } from '../pages/SentPage'

/**
 * Все маршруты объявлены здесь. Модуль фичи правит только свой маршрут и свою страницу,
 * поэтому параллельная работа над фичами не конфликтует в этом файле.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/inbox" replace /> },
      { path: 'inbox', element: <InboxPage /> },
      { path: 'sent', element: <SentPage /> },
      { path: 'friends', element: <FriendsPage /> },
      { path: 'letters/new', element: <LetterEditorPage /> },
      { path: 'letters/:id', element: <LetterPage /> },
      { path: 'letters/:id/edit', element: <LetterEditorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
]
