import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import i18n from '../shared/i18n'
import { doveStamp, winterStamp } from '../test/msw/handlers'
import { server } from '../test/msw/server'
import { renderAt } from '../test/render'
import { signInForTest } from '../test/session'
import { t } from '../test/i18n'
import { stampName } from '../features/letters/stampName'

const label = (key: string) => t(key, 'letters')
const stampLabel = (stamp: typeof winterStamp) => new RegExp(stampName(stamp, i18n.language))

/** Успешная загрузка каталога по умолчанию уже стоит в MSW — переопределяем точечно. */
function stampsServer(list: unknown[] | null = null, fail = false) {
  server.use(
    http.get('*/api/stamps', () =>
      fail
        ? HttpResponse.json({ error: 'server_error', message: 'Boom' }, { status: 500 })
        : HttpResponse.json(list ?? []),
    ),
  )
}

describe('вкладка «Коллекция»', () => {
  it('показывает каталог с описаниями и остатками, «закончилось» у нулевого', async () => {
    await signInForTest()
    renderAt('/collection')

    expect(
      await screen.findByRole('heading', { name: label('collection.title') }),
    ).toBeInTheDocument()
    expect(screen.getByText(winterStamp.description)).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t('seal.left', { ns: 'letters', count: winterStamp.quantity })),
    ).toBeInTheDocument()

    // Вид без запаса виден и помечен, но на странице его не «выбирают», поэтому
    // признак — только текст «закончилось».
    expect(screen.getByText(stampLabel(doveStamp))).toBeInTheDocument()
    expect(screen.getByText(label('seal.out'))).toBeInTheDocument()
  })

  it('пункт «Коллекция» есть в шапке и ведёт на /collection', async () => {
    await signInForTest()
    renderAt('/inbox')

    const link = await screen.findByRole('link', { name: t('nav.collection', 'common') })
    expect(link).toHaveAttribute('href', '/collection')

    await userEvent.click(link)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: label('collection.title') })).toBeInTheDocument(),
    )
  })

  it('ошибку загрузки показывает с «Повторить»', async () => {
    let attempts = 0
    server.use(
      http.get('*/api/stamps', () => {
        attempts += 1
        if (attempts === 1) return HttpResponse.error()
        return HttpResponse.json([winterStamp, doveStamp])
      }),
    )
    await signInForTest()
    renderAt('/collection')

    // HttpResponse.error() — обрыв сети: клиент превращает его в network_error.
    expect(await screen.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))
    await userEvent.click(screen.getByRole('button', { name: t('actions.retry', 'common') }))

    const section = within(screen.getByRole('main'))
    expect(await section.findByText(winterStamp.description)).toBeInTheDocument()
  })

  it('пустой каталог — не ошибка', async () => {
    stampsServer([])
    await signInForTest()
    renderAt('/collection')

    expect(await screen.findByText(label('collection.empty'))).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
