import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { City, Country } from '../api/types'
import { cityName, countryLabel } from '../features/city'
import i18n from '../shared/i18n'
import { countries, meWithoutCity, moscow, petersburg } from '../test/msw/handlers'
import { server } from '../test/msw/server'
import { renderAt } from '../test/render'
import { signInForTest } from '../test/session'
import { t } from '../test/i18n'

const city = (key: string) => t(key, 'city')
const cityWith = (key: string, options: Record<string, unknown>) =>
  i18n.t(key, { ns: 'city', ...options })

/** Название города в текущем языке теста: справочник отдаёт обе колонки. */
const named = (item: City) => new RegExp(cityName(item, i18n.language))

/** Кнопка страны в списке: в доступном имени и название, и число городов. */
const countryButton = (item: Country) => new RegExp(countryLabel(item, i18n.language))

/** Сессия нового пользователя: город ещё не выбран — иначе шаг выбора не появился бы. */
async function signInWithoutCity(): Promise<void> {
  server.use(http.get('*/api/users/me', () => HttpResponse.json(meWithoutCity)))
  await signInForTest()
}

function catalogueServer(cities: City[]): void {
  server.use(
    http.get('*/api/cities', ({ request }) => {
      const country = new URL(request.url).searchParams.get('country')
      return HttpResponse.json(
        country ? cities.filter((item) => item.country_code === country) : cities,
      )
    }),
  )
}

/** Выбор города занимает два шага: страна, затем город внутри неё. */
async function openCountry(item: Country = countries[0]!): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: countryButton(item) }))
}

describe('выбор города', () => {
  it('первый шаг — страны, второй — города выбранной страны', async () => {
    await signInWithoutCity()
    catalogueServer([moscow, petersburg])
    renderAt('/city')

    expect(await screen.findByRole('heading', { name: city('title') })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: named(moscow) })).toBeNull()

    await openCountry()

    expect(await screen.findByRole('radio', { name: named(moscow) })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: named(petersburg) })).toBeInTheDocument()
  })

  it('в списке стран видно число городов', async () => {
    await signInWithoutCity()
    catalogueServer([moscow, petersburg])
    renderAt('/city')

    expect(
      await screen.findByText(cityWith('citiesCount', { count: countries[0]!.city_count })),
    ).toBeInTheDocument()
  })

  it('без выбранного города сохранить нельзя', async () => {
    await signInWithoutCity()
    catalogueServer([moscow, petersburg])
    renderAt('/city')

    await openCountry()
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

    await openCountry()
    await userEvent.click(await screen.findByRole('radio', { name: named(petersburg) }))
    await userEvent.click(screen.getByRole('button', { name: city('submit') }))

    expect(
      await screen.findByRole('heading', { name: t('inbox.title', 'letters') }),
    ).toBeInTheDocument()
    expect(sent).toEqual([{ city_id: petersburg.id }])
  })

  it('запрос городов уходит с фильтром выбранной страны', async () => {
    await signInWithoutCity()
    const asked: string[] = []
    server.use(
      http.get('*/api/cities', ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('country') ?? '')
        return HttpResponse.json([moscow, petersburg])
      }),
    )
    renderAt('/city')

    await openCountry()

    expect(await screen.findByRole('radio', { name: named(moscow) })).toBeInTheDocument()
    expect(asked).toEqual(['RU'])
  })

  it('поиск фильтрует города выбранной страны', async () => {
    await signInWithoutCity()
    catalogueServer([moscow, petersburg])
    renderAt('/city')

    await openCountry()
    // Начало названия Санкт-Петербурга на языке интерфейса: тест не зависит от локали.
    const query = cityName(petersburg, i18n.language).slice(0, 5).toLowerCase()
    await userEvent.type(await screen.findByPlaceholderText(city('searchPlaceholder')), query)

    expect(await screen.findByRole('radio', { name: named(petersburg) })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: named(moscow) })).toBeNull()
  })

  it('возврат к странам сбрасывает выбранный город', async () => {
    await signInWithoutCity()
    catalogueServer([moscow, petersburg])
    renderAt('/city')

    await openCountry()
    await userEvent.click(await screen.findByRole('radio', { name: named(petersburg) }))
    await userEvent.click(screen.getByRole('button', { name: city('backToCountries') }))

    expect(await screen.findByRole('button', { name: countryButton(countries[0]!) })).toBeInTheDocument()
    await openCountry()
    expect(await screen.findByRole('button', { name: city('submit') })).toBeDisabled()
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

    await openCountry()
    await userEvent.click(await screen.findByRole('radio', { name: named(petersburg) }))
    await userEvent.click(screen.getByRole('button', { name: city('submit') }))

    expect(await screen.findByRole('alert')).toHaveTextContent(t('city_change_too_soon', 'errors'))
    expect(screen.getByRole('heading', { name: city('title') })).toBeInTheDocument()
  })
})
