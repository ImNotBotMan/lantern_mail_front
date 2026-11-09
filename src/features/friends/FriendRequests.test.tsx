import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { Friend, IncomingFriendRequest, OutgoingFriendRequest } from '../../api/types'
import i18n from '../../shared/i18n'
import { formatDate } from '../../shared/i18n/formatDate'
import { server } from '../../test/msw/server'
import { renderAt } from '../../test/render'
import { signInForTest } from '../../test/session'
import { t } from '../../test/i18n'

const incoming: IncomingFriendRequest = {
  id: '22222222-2222-2222-2222-222222222222',
  sender_username: 'boris',
  created_at: '2026-01-02T12:00:00Z',
}

const outgoing: OutgoingFriendRequest = {
  id: '33333333-3333-3333-3333-333333333333',
  recipient_username: 'anna',
  created_at: '2026-01-03T12:00:00Z',
}

const borisFriend: Friend = { username: 'boris', friends_since: '2026-01-04T12:00:00Z' }

type IncomingOutcome = 'ok' | 'error'

/**
 * Сервер заявок в памяти: принятие переносит заявку в друзья, отклонение и отзыв удаляют
 * запись — как на бэкенде, у пары всегда одно состояние.
 */
function requestsServer(incomingList: IncomingFriendRequest[], outgoingList: OutgoingFriendRequest[], outcome: IncomingOutcome = 'ok') {
  const state = {
    incoming: [...incomingList],
    outgoing: [...outgoingList],
    friends: [] as Friend[],
    accepted: [] as string[],
    declined: [] as string[],
    withdrawn: [] as string[],
    outcome,
  }

  server.use(
    http.get('*/api/friends/requests/incoming', () => HttpResponse.json(state.incoming)),
    http.get('*/api/friends/requests/outgoing', () => HttpResponse.json(state.outgoing)),
    http.get('*/api/friends', () => HttpResponse.json(state.friends)),
    http.post('*/api/friends/requests/:id/accept', ({ params }) => {
      const id = String(params.id)
      if (state.outcome === 'error') return HttpResponse.error()
      state.accepted.push(id)
      const request = state.incoming.find((item) => item.id === id)
      state.incoming = state.incoming.filter((item) => item.id !== id)
      if (request) state.friends.push(borisFriend)
      return HttpResponse.json(borisFriend)
    }),
    http.post('*/api/friends/requests/:id/decline', ({ params }) => {
      const id = String(params.id)
      state.declined.push(id)
      state.incoming = state.incoming.filter((item) => item.id !== id)
      return new HttpResponse(null, { status: 204 })
    }),
    http.delete('*/api/friends/requests/:id', ({ params }) => {
      const id = String(params.id)
      state.withdrawn.push(id)
      state.outgoing = state.outgoing.filter((item) => item.id !== id)
      return new HttpResponse(null, { status: 204 })
    }),
  )

  return state
}

/** Секция по заголовку: на странице три списка, запросы скоупим по своему. */
async function section(title: string) {
  const heading = await screen.findByRole('heading', { name: title })
  const node = heading.closest('section')
  if (!node) throw new Error(`секция «${title}» не найдена`)
  return within(node)
}

async function renderFriends() {
  await signInForTest()
  renderAt('/friends')
  await screen.findByRole('heading', { name: t('list.title', 'friends') })
}

describe('заявки ко мне', () => {
  it('показывает отправителя и время заявки', async () => {
    requestsServer([incoming], [])
    await renderFriends()
    const list = await section(t('requests.incoming', 'friends'))

    expect(await list.findByText('boris')).toBeInTheDocument()
    const when = formatDate(incoming.created_at, i18n.language)
    expect(list.getByText((content) => content.includes(when))).toBeInTheDocument()
  })

  it('«Принять» делает пользователя другом, заявка исчезает', async () => {
    const state = requestsServer([incoming], [])
    await renderFriends()
    const list = await section(t('requests.incoming', 'friends'))
    await list.findByText('boris')

    await userEvent.click(list.getByRole('button', { name: t('requests.accept', 'friends') }))

    expect(state.accepted).toEqual([incoming.id])
    // Дружба взаимна: boris появился в списке друзей, заявки больше нет.
    const friends = await section(t('list.title', 'friends'))
    expect(await friends.findByText('boris')).toBeInTheDocument()
    expect(list.queryByText('boris')).not.toBeInTheDocument()
  })

  it('«Отклонить» убирает заявку без появления в друзьях', async () => {
    const state = requestsServer([incoming], [])
    await renderFriends()
    const list = await section(t('requests.incoming', 'friends'))
    await list.findByText('boris')

    await userEvent.click(list.getByRole('button', { name: t('requests.decline', 'friends') }))

    expect(state.declined).toEqual([incoming.id])
    expect(await list.findByText(t('requests.incomingEmpty', 'friends'))).toBeInTheDocument()
    const friends = await section(t('list.title', 'friends'))
    expect(friends.queryByText('boris')).not.toBeInTheDocument()
  })

  it('пусто — отдельный текст; ошибка загрузки — с повтором', async () => {
    requestsServer([], [])
    await renderFriends()
    const list = await section(t('requests.incoming', 'friends'))

    expect(await list.findByText(t('requests.incomingEmpty', 'friends'))).toBeInTheDocument()
    expect(list.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ошибка загрузки предлагает повторить', async () => {
    let failed = false
    server.use(
      http.get('*/api/friends/requests/incoming', () => {
        if (!failed) {
          failed = true
          return HttpResponse.error()
        }
        return HttpResponse.json([incoming])
      }),
    )
    await renderFriends()
    const list = await section(t('requests.incoming', 'friends'))

    expect(await list.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))

    await userEvent.click(list.getByRole('button', { name: t('actions.retry', 'common') }))
    expect(await list.findByText('boris')).toBeInTheDocument()
  })
})

describe('мои заявки', () => {
  it('показывает получателя и отзывает заявку', async () => {
    const state = requestsServer([], [outgoing])
    await renderFriends()
    const list = await section(t('requests.outgoing', 'friends'))

    expect(await list.findByText('anna')).toBeInTheDocument()

    await userEvent.click(list.getByRole('button', { name: t('requests.withdraw', 'friends') }))

    expect(state.withdrawn).toEqual([outgoing.id])
    expect(await list.findByText(t('requests.outgoingEmpty', 'friends'))).toBeInTheDocument()
  })

  it('пусто — отдельный текст', async () => {
    requestsServer([], [])
    await renderFriends()
    const list = await section(t('requests.outgoing', 'friends'))

    expect(await list.findByText(t('requests.outgoingEmpty', 'friends'))).toBeInTheDocument()
    expect(list.queryByRole('alert')).not.toBeInTheDocument()
  })
})
