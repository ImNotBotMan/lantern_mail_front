import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { LetterResponse, LetterSeal } from '../../api/types'
import i18n from '../../shared/i18n'
import { doveStamp, letter, stamps, winterStamp } from '../../test/msw/handlers'
import { server } from '../../test/msw/server'
import { renderAt } from '../../test/render'
import { signInForTest } from '../../test/session'
import { t } from '../../test/i18n'
import { stampName } from './stampName'

const label = (key: string) => t(key, 'letters')
const stampLabel = (stamp: typeof winterStamp) => new RegExp(stampName(stamp, i18n.language))
/** Имя радиокнопки — весь текст строки: название плюс пояснение. */
const noStampRadio = () => new RegExp(label('seal.noStamp'))

interface SealServerOptions {
  fail?: { status: number; code: string }
}

/**
 * Сервер запечатывания: копит тела запросов и считает запросы каталога. Второй запрос
 * каталога — след инвалидации после успешного запечатывания.
 */
function sealServer({ fail }: SealServerOptions = {}) {
  const state = { bodies: [] as LetterSeal[], stampRequests: 0 }
  let current: LetterResponse = letter

  server.use(
    http.get('*/api/letters/sent', () => HttpResponse.json([])),
    http.get('*/api/letters/:id', () => HttpResponse.json(current)),
    http.get('*/api/stamps', () => {
      state.stampRequests += 1
      return HttpResponse.json(stamps)
    }),
    http.post('*/api/letters/:id/seal', async ({ request }) => {
      const body = (await request.json()) as LetterSeal
      state.bodies.push(body)
      if (fail) {
        return HttpResponse.json({ error: fail.code, message: fail.code }, { status: fail.status })
      }
      current = { ...current, status: 'sealed', sealed_at: '2026-01-02T12:00:00Z' }
      return HttpResponse.json(current)
    }),
  )

  return state
}

/** Экран черновика: «Запечатать» открывает выбор марки. */
async function openPicker() {
  await signInForTest()
  renderAt(`/letters/${letter.id}`)
  await userEvent.click(await screen.findByRole('button', { name: label('editor.seal') }))
  return within(await screen.findByRole('dialog', { name: label('seal.title') }))
}

describe('выбор марки при запечатывании', () => {
  it('показывает каталог: «без марки» по умолчанию, остатки и «закончилось»', async () => {
    sealServer()
    const dialog = await openPicker()

    const noStamp = dialog.getByRole('radio', { name: noStampRadio() })
    expect(noStamp).toBeChecked()
    // Фокус вошёл в диалог и стоит на выборе по умолчанию.
    expect(noStamp).toHaveFocus()

    expect(dialog.getByRole('radio', { name: stampLabel(winterStamp) })).toBeEnabled()
    expect(
      dialog.getByText(i18n.t('seal.left', { ns: 'letters', count: winterStamp.quantity })),
    ).toBeInTheDocument()

    // Вид без запаса виден, но не выбирается.
    const out = dialog.getByRole('radio', { name: stampLabel(doveStamp) })
    expect(out).toBeDisabled()
    expect(dialog.getByText(label('seal.out'))).toBeInTheDocument()
  })

  it('выбранная марка уходит одним запросом, коллекция перезапрашивается', async () => {
    const state = sealServer()
    const dialog = await openPicker()

    await userEvent.click(dialog.getByRole('radio', { name: stampLabel(winterStamp) }))
    await userEvent.click(dialog.getByRole('button', { name: label('seal.confirm') }))

    await waitFor(() => expect(state.bodies).toEqual([{ stamp_id: winterStamp.id }]))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(state.stampRequests).toBe(2))
    expect(await screen.findAllByText(label('status.sealed'))).not.toHaveLength(0)
    expect(screen.queryByRole('button', { name: label('editor.seal') })).toBeNull()
  })

  it('«без марки» запечатывает письмо запросом без stamp_id', async () => {
    const state = sealServer()
    const dialog = await openPicker()

    await userEvent.click(dialog.getByRole('button', { name: label('seal.confirm') }))

    await waitFor(() => expect(state.bodies).toEqual([{}]))
    expect(state.bodies[0]).not.toHaveProperty('stamp_id')
  })

  it('409 not_enough_stamps показывает ошибку в диалоге и сохраняет выбор', async () => {
    const state = sealServer({ fail: { status: 409, code: 'not_enough_stamps' } })
    const dialog = await openPicker()

    const stamp = dialog.getByRole('radio', { name: stampLabel(winterStamp) })
    await userEvent.click(stamp)
    await userEvent.click(dialog.getByRole('button', { name: label('seal.confirm') }))

    expect(await dialog.findByRole('alert')).toHaveTextContent(t('not_enough_stamps', 'errors'))
    expect(stamp).toBeChecked()
    expect(screen.getByRole('dialog', { name: label('seal.title') })).toBeInTheDocument()
    // Диалог не закрылся — повтор возможен, но запрос пока один.
    expect(state.bodies).toEqual([{ stamp_id: winterStamp.id }])
  })

  it('Esc закрывает диалог без запроса и возвращает фокус кнопке', async () => {
    const state = sealServer()
    await signInForTest()
    renderAt(`/letters/${letter.id}`)
    const trigger = await screen.findByRole('button', { name: label('editor.seal') })

    await userEvent.click(trigger)
    await screen.findByRole('dialog', { name: label('seal.title') })
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(state.bodies).toEqual([])
    expect(trigger).toHaveFocus()
  })

  it('отказ каталога не мешает запечатать без марки', async () => {
    const state = sealServer()
    server.use(
      http.get('*/api/stamps', () =>
        HttpResponse.json({ error: 'server_error', message: 'Boom' }, { status: 500 }),
      ),
    )
    const dialog = await openPicker()

    expect(await dialog.findByRole('alert')).toHaveTextContent(t('server_error', 'errors'))
    expect(dialog.getByRole('radio', { name: noStampRadio() })).toBeChecked()

    await userEvent.click(dialog.getByRole('button', { name: label('seal.confirm') }))
    await waitFor(() => expect(state.bodies).toEqual([{}]))
  })
})
