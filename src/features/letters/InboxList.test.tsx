import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { IncomingLetterView } from '../../api/types'
import i18n from '../../shared/i18n'
import { formatDate } from '../../shared/i18n/formatDate'
import { envelope, incomingLetter, readIncomingLetter } from '../../test/msw/handlers'
import { server } from '../../test/msw/server'
import { renderAt } from '../../test/render'
import { signInForTest } from '../../test/session'
import { t } from '../../test/i18n'

const label = (key: string) => t(key, 'letters')

/** Отправитель в конверте приходит с сервера строкой; в фикстуре он известен. */
const sender = envelope.sender_username ?? ''

/** Строка «когда» так, как её собирает модуль: подпись момента плюс дата. */
const whenLine = (moment: string, value: string) =>
  i18n.t('when.line', {
    ns: 'letters',
    label: t(`when.${moment}`, 'letters'),
    date: formatDate(value, i18n.language),
  })

function inboxServer(letters: IncomingLetterView[]) {
  const state = { listRequests: 0, letters }

  server.use(
    http.get('*/api/letters/inbox', () => {
      state.listRequests += 1
      return HttpResponse.json(state.letters)
    }),
  )

  return state
}

async function renderInbox() {
  await signInForTest()
  renderAt('/inbox')
  await screen.findByRole('heading', { name: label('inbox.title') })
}

describe('входящие', () => {
  it('показывает конверт без текста и без времени доставки', async () => {
    inboxServer([envelope])
    await renderInbox()

    expect(await screen.findByText(sender)).toBeInTheDocument()
    expect(screen.getByText(label('status.in_transit'))).toBeInTheDocument()
    expect(screen.getByText(label('inbox.onTheWay'))).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(label('when.deliver')))).toBeNull()
  })

  it('показывает доставленное и прочитанное письмо с их датами', async () => {
    inboxServer([incomingLetter, readIncomingLetter])
    await renderInbox()

    expect(
      await screen.findByText(whenLine('delivered', incomingLetter.delivered_at)),
    ).toBeInTheDocument()
    expect(screen.getByText(label('status.delivered'))).toBeInTheDocument()

    expect(
      screen.getByText(
        whenLine('read', readIncomingLetter.read_at ?? readIncomingLetter.delivered_at),
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(label('status.read'))).toBeInTheDocument()
  })

  it('пустые входящие объясняют, что письма придут сами', async () => {
    inboxServer([])
    await renderInbox()

    expect(await screen.findByText(label('inbox.empty'))).toBeInTheDocument()
  })

  it('ошибку загрузки показывает с кнопкой «Повторить»', async () => {
    let attempts = 0
    server.use(
      http.get('*/api/letters/inbox', () => {
        attempts += 1
        if (attempts === 1) return HttpResponse.error()
        return HttpResponse.json([envelope])
      }),
    )
    await renderInbox()

    expect(await screen.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))

    await userEvent.click(screen.getByRole('button', { name: t('actions.retry', 'common') }))

    expect(await screen.findByText(sender)).toBeInTheDocument()
  })

  it('конверт ведёт на экран письма', async () => {
    inboxServer([envelope])
    await renderInbox()

    const main = within(screen.getByRole('main'))
    expect(await main.findByRole('link', { name: sender })).toHaveAttribute(
      'href',
      `/letters/${envelope.id}`,
    )
  })
})
