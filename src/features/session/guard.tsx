import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { errorMessage } from '../../shared/i18n/apiError'
import { ErrorState, Spinner } from '../../shared/ui'
import type { ApiError } from '../../api/errors'
import { bootstrapSession, retryBootstrapSession } from './sessionStore'
import { useSession } from './useSession'
import styles from './guard.module.css'

/** Тихая проверка сессии при загрузке — из любого guard'а, один раз на вкладку. */
function useBootstrapSession(): void {
  useEffect(() => {
    void bootstrapSession()
  }, [])
}

/** Пока идёт проверка, приложение не мигает экраном входа. */
function SessionCheck({ error }: { error: ApiError | null }) {
  return (
    <div className={styles.check}>
      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void retryBootstrapSession()} />
      ) : (
        <Spinner />
      )}
    </div>
  )
}

/** Защищённые маршруты: анонимного пользователя возвращает на вход, запомнив адрес. */
export function RequireAuth() {
  useBootstrapSession()
  const { status, error } = useSession()
  const location = useLocation()

  if (status === 'loading') return <SessionCheck error={error} />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Экраны входа: авторизованному там делать нечего. */
export function GuestOnly() {
  useBootstrapSession()
  const { status, error } = useSession()

  if (status === 'loading') return <SessionCheck error={error} />
  if (status === 'authenticated') return <Navigate to="/inbox" replace />
  return <Outlet />
}
