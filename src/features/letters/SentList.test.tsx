import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { LetterResponse } from '../../api/types'
import i18n from '../../shared/i18n'
import { formatDate } from '../../shared/i18n/formatDate'
import { letter as draftLetter, sealedLetter, transitLetter } from '../../test/msw/handlers'
import { server } from '../../test/msw/server'
import { renderAt } from '../../test/render'
import { signInForTest } from '../../test/session'
import { t } from '../../test/i18n'

const label = (key: string) => t(key, 'letters')

type SendOutcome = 'ok' | 'not_friends' | 'error'

/** Сервер писем в памяти: действия меняют те же записи, которые отдаёт список. */
function lettersServer(initial: LetterResponse[], sendOutcome: SendOutcome = 'ok') {
  const state = {
    letters: [...initial],
    listRequests: 0,
    sends: [] as string[],
    deletes: [] as string[],
    sendOutcome,
  }

  server.use(
    http.get('*/api/letters/sent', () => {
      state.listRequests += 1
      return HttpResponse.json(state.letters)
    }),
    http.post('*/api/letters/:id/send', ({ params }) => {
      const id = String(params.id)
      state.sends.push(id)
      if (state.sendOutcome === 'not_friends') {
        return HttpResponse.json(
          { error: 'not_friends', message: 'Recipient is not a friend' },
          { status: 409 },
        )
      }
      if (state.sendOutcome === 'error') return HttpResponse.error()

      state.letters = state.letters.map((item) =>
        item.id === id ? { ...item, status: 'in_transit' } : item,
      )
      return HttpResponse.json(state.letters.find((item) => item.id === id))
    }),
    http.delete('*/api/letters/:id', ({ params }) => {
      const id = String(params.id)
      state.deletes.push(id)
      state.letters = state.letters.filter((item) => item.id !== id)
      return new HttpResponse(null, { status: 204 })
    }),
  )

  return state
}

async function renderSent() {
  await signInForTest()
  renderAt('/sent')
  await screen.findByRole('heading', { name: label('sent.title') })
}

describe('отправленные', () => {
  it('показывает письма со статусом, получателем и датой', async () => {
    lettersServer([draftLetter, sealedLetter, transitLetter])
    await renderSent()

    expect(await screen.findAllByText('anna')).toHaveLength(3)

    expect(screen.getByText(label('status.draft'))).toBeInTheDocument()
    expect(screen.getByText(label('status.sealed'))).toBeInTheDocument()
    expect(screen.getByText(label('status.in_transit'))).toBeInTheDocument()

    // Черновик показывает момент создания, письмо в пути — ожидаемую доставку.
    const created = formatDate(draftLetter.created_at, i18n.language)
    expect(
      screen.getByText(
        i18n.t('when.line', {
          ns: 'letters',
          label: label('when.created'),
          date: created,
        }),
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(new RegExp(label('when.deliver')))).toBeInTheDocument()
  })

  it('пустой список подсказывает написать письмо', async () => {
    lettersServer([])
    await renderSent()

    expect(await screen.findByText(label('sent.empty'))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: label('sent.new') })).toBeInTheDocument()
  })

  it('отправляет запечатанное письмо только после подтверждения', async () => {
    const state = lettersServer([sealedLetter])
    await renderSent()

    await userEvent.click(await screen.findByRole('button', { name: label('editor.send') }))
    expect(screen.getByText(label('editor.sendConfirm'))).toBeInTheDocument()
    expect(state.sends).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: label('editor.sendConfirmYes') }))

    expect(await screen.findByText(label('status.in_transit'))).toBeInTheDocument()
    expect(state.sends).toEqual([sealedLetter.id])
  })

  it('не-другу отправка показывает ошибку сервера и не меняет статус', async () => {
    lettersServer([sealedLetter], 'not_friends')
    await renderSent()

    await userEvent.click(await screen.findByRole('button', { name: label('editor.send') }))
    await userEvent.click(screen.getByRole('button', { name: label('editor.sendConfirmYes') }))

    expect(await screen.findByText(t('not_friends', 'errors'))).toBeInTheDocument()
    expect(screen.getByText(label('status.sealed'))).toBeInTheDocument()
  })

  it('удаляет черновик после подтверждения', async () => {
    const state = lettersServer([draftLetter])
    await renderSent()

    await userEvent.click(await screen.findByRole('button', { name: label('editor.delete') }))
    expect(screen.getByText(label('editor.deleteConfirm'))).toBeInTheDocument()
    expect(state.deletes).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: label('editor.deleteConfirmYes') }))

    expect(await screen.findByText(label('sent.empty'))).toBeInTheDocument()
    expect(state.deletes).toEqual([draftLetter.id])
  })

  it('ошибку загрузки показывает с кнопкой «Повторить»', async () => {
    let attempts = 0
    server.use(
      http.get('*/api/letters/sent', () => {
        attempts += 1
        if (attempts === 1) return HttpResponse.error()
        return HttpResponse.json([draftLetter])
      }),
    )
    await renderSent()

    expect(await screen.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))

    await userEvent.click(screen.getByRole('button', { name: t('actions.retry', 'common') }))

    expect(await screen.findByText('anna')).toBeInTheDocument()
  })
})
