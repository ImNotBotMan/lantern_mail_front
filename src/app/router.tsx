import { Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'

import { AppLayout } from './layout/AppLayout'
import { AuthLayout } from './layout/AuthLayout'
import { CityRequired, GuestOnly, RequireAuth, UsernameRequired } from '../features/session'
import { AccountPage } from '../pages/AccountPage'
import { ChooseUsernamePage } from '../pages/ChooseUsernamePage'
import { CityPage } from '../pages/CityPage'
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
 *
 * Защита — лестницей guard'ов: `RequireAuth` закрывает экраны продукта, `UsernameRequired`
 * отправляет пришедшего через Google выбрать имя, `CityRequired` — выбрать город;
 * `GuestOnly` уводит авторизованного пользователя со страниц входа и регистрации.
 * Шаги (`/choose-username`, `/city`) стоят до соответствующего guard'а — иначе он уводил бы
 * на них с них же.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        // Шаг выбора имени: уже требует входа, но ещё не продукт
        path: 'choose-username',
        element: <AuthLayout />,
        children: [{ index: true, element: <ChooseUsernamePage /> }],
      },
      {
        // Без имени не пускает ни выбор города, ни продукт: по имени адресуют письма
        element: <UsernameRequired />,
        children: [
          {
            // Шаг выбора города: уже требует входа, но ещё не продукт
            path: 'city',
            element: <AuthLayout />,
            children: [{ index: true, element: <CityPage /> }],
          },
          {
            // Продукт без города недоступен: guard уводит на /city
            element: <CityRequired />,
            children: [
              {
                element: <AppLayout />,
                children: [
                  { index: true, element: <Navigate to="/inbox" replace /> },
                  { path: 'inbox', element: <InboxPage /> },
                  { path: 'sent', element: <SentPage /> },
                  { path: 'friends', element: <FriendsPage /> },
                  { path: 'account', element: <AccountPage /> },
                  { path: 'letters/new', element: <LetterEditorPage /> },
                  { path: 'letters/:id', element: <LetterPage /> },
                  { path: 'letters/:id/edit', element: <LetterEditorPage /> },
                  { path: '*', element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '/',
    element: <GuestOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },
    ],
  },
]
