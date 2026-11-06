import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'

import { useSession } from '../features/session'
import { routes } from './router'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Свежесть без реалтайма: перезапрос при возврате на вкладку и при входе на экран.
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      retry: 1,
    },
  },
})

const router = createBrowserRouter(routes)

/**
 * Данные прошлого пользователя не должны достаться следующему на том же устройстве:
 * сессия не знает про кэш, поэтому о закрытии сессии его очищает слой приложения.
 */
function SessionCacheReset({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { status } = useSession()

  useEffect(() => {
    if (status === 'anonymous') queryClient.clear()
  }, [status, queryClient])

  return children
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionCacheReset>
        <RouterProvider router={router} />
      </SessionCacheReset>
    </QueryClientProvider>
  )
}
