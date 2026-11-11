import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { City } from '../api/types'
import { cityName } from '../features/city'
import i18n from '../shared/i18n'
import { meWithoutCity, moscow, petersburg } from '../test/msw/handlers'
import { server } from '../test/msw/server'
import { renderAt } from '../test/render'
import { signInForTest } from '../test/session'
import { t } from '../test/i18n'

const city = (key: string) => t(key, 'city')

/** Название города в текущем языке теста: справочник отдаёт обе колонки. */
const named = (item: City) => new RegExp(cityName(item, i18n.language))

/** Сессия нового пользователя: город ещё не выбран — иначе шаг выбора не появился бы. */
async function signInWithoutCity(): Promise<void> {
  server.use(http.get('*/api/users/me', () => HttpResponse.json(meWithoutCity)))
  await signInForTest()
}

function catalogueServer(cities: City[]): void {
  server.use(http.get('*/api/cities', () => HttpResponse.json(cities)))
}

describe('выбор города', () => {
  it('показывает справочник на языке интерфейса', async () => {
    await signInWithoutCity()
    catalogueServer([moscow, petersburg])
    renderAt('/city')

    expect(await screen.findByRole('heading', { name: city('title') })).toBeInTheDocument()
    expect(await screen.findByRole('radio', { name: named(moscow) })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: named(petersburg) })).toBeInTheDocument()
  })

  it('без выбранного города сохранить нельзя', async () => {
    await signInWithoutCity()
    catalogueServer([moscow, petersburg])
    renderAt('/city')

    expect(await screen.findByRole('button', { name: city('submit') })).toBeDisabled()
  })

  it('выбранный город уходит на сервер и открывает входящие', async () => {
    await signInWithoutCity()
    catalogueServer([moscow, petersburg])
    const sent: unknown[] = []
    server.use(
      http.patch('*/api/users/me', async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({
          ...meWithoutCity,
          city: petersburg,
          city_changed_at: '2026-02-01T12:00:00Z',
        })
      }),
    )
    renderAt('/city')

    await userEvent.click(await screen.findByRole('radio', { name: named(petersburg) }))
    await userEvent.click(screen.getByRole('button', { name: city('submit') }))

    expect(
      await screen.findByRole('heading', { name: t('inbox.title', 'letters') }),
    ).toBeInTheDocument()
    expect(sent).toEqual([{ city_id: petersburg.id }])
  })

  it('отказ сервера показывается ошибкой под справочником', async () => {
    await signInWithoutCity()
    catalogueServer([moscow, petersburg])
    server.use(
      http.patch('*/api/users/me', () =>
        HttpResponse.json({ error: 'city_change_too_soon', message: 'Too soon' }, { status: 409 }),
      ),
    )
    renderAt('/city')

    await userEvent.click(await screen.findByRole('radio', { name: named(petersburg) }))
    await userEvent.click(screen.getByRole('button', { name: city('submit') }))

    expect(await screen.findByRole('alert')).toHaveTextContent(t('city_change_too_soon', 'errors'))
    expect(screen.getByRole('heading', { name: city('title') })).toBeInTheDocument()
  })
})
