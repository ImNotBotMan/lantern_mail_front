import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { Friend } from '../../api/types'
import i18n from '../../shared/i18n'
import { formatDate } from '../../shared/i18n/formatDate'
import { server } from '../../test/msw/server'
import { renderAt } from '../../test/render'
import { signInForTest } from '../../test/session'
import { t } from '../../test/i18n'

const anna: Friend = { username: 'anna', friends_since: '2026-01-05T12:00:00Z' }
const boris: Friend = { username: 'boris', friends_since: '2026-03-09T12:00:00Z' }

type DeleteOutcome = 'ok' | 'error' | 'not_found'

/** Сервер друзей в памяти: список меняется после DELETE, как на бэкенде. */
function friendsServer(initial: Friend[], outcome: DeleteOutcome = 'ok') {
  const state = {
    friends: [...initial],
    listRequests: 0,
    deletes: [] as string[],
    outcome,
  }

  server.use(
    http.get('*/api/friends', () => {
      state.listRequests += 1
      return HttpResponse.json(state.friends)
    }),
    http.delete('*/api/friends/:username', ({ params }) => {
      const username = String(params.username)
      state.deletes.push(username)
      if (state.outcome === 'error') return HttpResponse.error()

      state.friends = state.friends.filter((friend) => friend.username !== username)
      if (state.outcome === 'not_found') {
        return HttpResponse.json({ error: 'not_found', message: 'Not found' }, { status: 404 })
      }
      return new HttpResponse(null, { status: 204 })
    }),
  )

  return state
}

async function renderFriends() {
  await signInForTest()
  renderAt('/friends')
  await screen.findByRole('heading', { name: t('list.title', 'friends') })

  // На странице три секции (друзья, заявки ко мне, мои заявки) — запросы скоупим по своей.
  const heading = screen.getByRole('heading', { name: t('list.title', 'friends') })
  const section = heading.closest('section')
  if (!section) throw new Error('секция списка друзей не найдена')
  return within(section)
}

async function confirmRemoval(list: ReturnType<typeof within>) {
  await userEvent.click(list.getByRole('button', { name: t('list.unfriend', 'friends') }))
  await userEvent.click(list.getByRole('button', { name: t('list.unfriendConfirmYes', 'friends') }))
}

describe('список друзей', () => {
  it('показывает имя и с какого момента дружба', async () => {
    friendsServer([anna, boris])
    const list = await renderFriends()

    expect(await list.findByText('anna')).toBeInTheDocument()
    expect(list.getByText('boris')).toBeInTheDocument()

    const since = formatDate(anna.friends_since, i18n.language)
    expect(list.getByText((content) => content.includes(since))).toBeInTheDocument()
  })

  it('пустой список — отдельный текст, а не ошибка', async () => {
    friendsServer([])
    const list = await renderFriends()

    expect(await list.findByText(t('list.empty', 'friends'))).toBeInTheDocument()
    expect(list.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ошибка загрузки предлагает повторить и не выдаёт себя за пусто', async () => {
    let failed = false
    server.use(
      http.get('*/api/friends', () => {
        if (!failed) {
          failed = true
          return HttpResponse.error()
        }
        return HttpResponse.json([anna])
      }),
    )
    const list = await renderFriends()

    expect(await list.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))
    expect(list.queryByText(t('list.empty', 'friends'))).not.toBeInTheDocument()

    await userEvent.click(list.getByRole('button', { name: t('actions.retry', 'common') }))

    expect(await list.findByText('anna')).toBeInTheDocument()
  })

  it('кнопка «Обновить» перезапрашивает список', async () => {
    const state = friendsServer([anna])
    const list = await renderFriends()
    await list.findByText('anna')
    const before = state.listRequests

    await userEvent.click(list.getByRole('button', { name: t('actions.refresh', 'common') }))

    expect(await list.findByText('anna')).toBeInTheDocument()
    expect(state.listRequests).toBeGreaterThan(before)
  })
})

describe('удаление из друзей', () => {
  it('спрашивает подтверждение и предупреждает об отмене летящих писем', async () => {
    const state = friendsServer([anna])
    const list = await renderFriends()
    await list.findByText('anna')

    await userEvent.click(list.getByRole('button', { name: t('list.unfriend', 'friends') }))

    const question = t('list.unfriendConfirm', 'friends').replace('{{username}}', 'anna')
    expect(list.getByText(question)).toBeInTheDocument()

    await userEvent.click(list.getByRole('button', { name: t('actions.cancel', 'common') }))

    expect(list.queryByText(question)).not.toBeInTheDocument()
    expect(list.getByText('anna')).toBeInTheDocument()
    expect(state.deletes).toHaveLength(0)
  })

  it('после подтверждения друг исчезает из списка', async () => {
    const state = friendsServer([anna])
    const list = await renderFriends()
    await list.findByText('anna')

    await confirmRemoval(list)

    expect(await list.findByText(t('list.empty', 'friends'))).toBeInTheDocument()
    expect(state.deletes).toEqual(['anna'])
  })

  it('ошибка удаления показывается в строке, друг остаётся', async () => {
    friendsServer([anna], 'error')
    const list = await renderFriends()
    await list.findByText('anna')

    await confirmRemoval(list)

    expect(await list.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))
    expect(list.getByText('anna')).toBeInTheDocument()
  })

  it('удалённый ранее друг молча пропадает, без ошибки', async () => {
    friendsServer([anna], 'not_found')
    const list = await renderFriends()
    await list.findByText('anna')

    await confirmRemoval(list)

    expect(await list.findByText(t('list.empty', 'friends'))).toBeInTheDocument()
    expect(list.queryByRole('alert')).not.toBeInTheDocument()
  })
})
