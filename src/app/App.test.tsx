import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import i18n from '../shared/i18n'
import { routes } from './router'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('маршруты', () => {
  it('корень ведёт во входящие', async () => {
    renderAt('/')
    expect(
      await screen.findByRole('heading', { name: i18n.t('inbox.title') }),
    ).toBeInTheDocument()
  })

  it('неизвестный адрес показывает 404 внутри layout', async () => {
    renderAt('/nothing-here')
    expect(
      await screen.findByRole('heading', { name: i18n.t('errors.not_found') }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: i18n.t('app.name') })).toBeInTheDocument()
  })
})
