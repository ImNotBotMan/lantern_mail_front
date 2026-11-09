import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import type { Relationship, UserSearchResult } from '../../api/types'
import { server } from '../../test/msw/server'
import { renderAt } from '../../test/render'
import { signInForTest } from '../../test/session'
import { t } from '../../test/i18n'

const DEBOUNCE_MS = 400

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Сервер поиска в памяти: считает запросы и помнит последний q. */
function searchServer(results: UserSearchResult[] | 'error' = []) {
  const state = { searches: [] as string[], posts: 0, outcome409: false }

  server.use(
    http.get('*/api/users/search', ({ request }) => {
      const query = new URL(request.url).searchParams.get('q') ?? ''
      state.searches.push(query)
      if (results === 'error') return HttpResponse.error()
      return HttpResponse.json(results)
    }),
    http.post('*/api/friends/requests', () => {
      state.posts += 1
      if (state.outcome409) {
        return HttpResponse.json(
          { error: 'incoming_friend_request_exists', message: 'Incoming request exists' },
          { status: 409 },
        )
      }
      return HttpResponse.json(
        { id: '44444444-4444-4444-4444-444444444444', recipient_username: 'anna', created_at: '2026-01-03T12:00:00Z' },
        { status: 201 },
      )
    }),
  )

  return state
}

function result(relationship: Relationship, requestId: string | null = null): UserSearchResult {
  return { username: 'anna', relationship, request_id: requestId }
}

async function renderSearch() {
  await signInForTest()
  renderAt('/friends')
  await screen.findByRole('heading', { name: t('list.title', 'friends') })

  const heading = screen.getByRole('heading', { name: t('search.label', 'friends') })
  const section = heading.closest('section')
  if (!section) throw new Error('секция поиска не найдена')
  return within(section)
}

async function typeQuery(section: ReturnType<typeof within>, text: string) {
  await userEvent.type(section.getByLabelText(t('search.label', 'friends')), text)
}

afterEach(() => {
  server.resetHandlers()
})

describe('поиск пользователей', () => {
  it('не уходит короче трёх символов и дебаунсится до одного запроса', async () => {
    const state = searchServer([result('none')])
    const section = await renderSearch()

    await typeQuery(section, 'an')
    await wait(DEBOUNCE_MS)
    expect(state.searches).toEqual([])
    expect(section.getByText(t('search.hint', 'friends'))).toBeInTheDocument()

    await typeQuery(section, 'na')
    expect(await section.findByText('anna')).toBeInTheDocument()
    expect(state.searches).toEqual(['anna'])
  })

  it('приводит ввод к нижнему регистру', async () => {
    const state = searchServer([result('none')])
    const section = await renderSearch()

    await typeQuery(section, 'ANna')
    expect(await section.findByText('anna')).toBeInTheDocument()
    expect(state.searches).toEqual(['anna'])
  })

  it('недопустимые символы не отправляются и показывают «Проверьте имя»', async () => {
    const state = searchServer([result('none')])
    const section = await renderSearch()

    await typeQuery(section, 'анна!')
    await wait(DEBOUNCE_MS)
    expect(state.searches).toEqual([])
    expect(section.getByText(t('search.invalid', 'friends'))).toBeInTheDocument()
  })

  it('пустой результат — отдельный текст, а не ошибка', async () => {
    searchServer([])
    const section = await renderSearch()

    await typeQuery(section, 'anna')
    expect(await section.findByText(t('search.empty', 'friends'))).toBeInTheDocument()
    expect(section.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ошибка сети — сообщение и «Повторить», не выдаёт себя за пусто', async () => {
    searchServer('error')
    const section = await renderSearch()

    await typeQuery(section, 'anna')
    expect(await section.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))
    expect(section.queryByText(t('search.empty', 'friends'))).not.toBeInTheDocument()
    expect(section.getByRole('button', { name: t('actions.retry', 'common') })).toBeInTheDocument()
  })

  it.each([
    ['none', ['search.add']],
    ['outgoing_request', ['search.requested', 'search.withdraw']],
    ['incoming_request', ['search.accept', 'search.decline']],
    ['friend', ['search.unfriend']],
  ] as const)('для relationship %s показывает действия %j', async (relationship, keys) => {
    searchServer([result(relationship, '55555555-5555-5555-5555-555555555555')])
    const section = await renderSearch()

    await typeQuery(section, 'anna')
    await section.findByText('anna')
    for (const key of keys) {
      expect(section.getByText(t(key, 'friends'))).toBeInTheDocument()
    }
  })

  it('«Добавить в друзья» отправляет заявку, и строка перечитывает связь', async () => {
    const state = searchServer([result('none')])
    const section = await renderSearch()

    await typeQuery(section, 'anna')
    await section.findByText('anna')
    await userEvent.click(section.getByRole('button', { name: t('search.add', 'friends') }))

    expect(state.posts).toBe(1)
    // Мутация сбрасывает кэш друзей: поиск перечитан, связь обновилась по серверу.
    expect(await section.findByText(t('search.add', 'friends'))).toBeInTheDocument()
    expect(state.searches).toHaveLength(2)
  })

  it('409 «вам уже отправили заявку» видно сообщением, а списки обновляются', async () => {
    const state = searchServer([result('none')])
    state.outcome409 = true
    const section = await renderSearch()

    await typeQuery(section, 'anna')
    await section.findByText('anna')
    await userEvent.click(section.getByRole('button', { name: t('search.add', 'friends') }))

    expect(await section.findByRole('alert')).toHaveTextContent(
      t('incoming_friend_request_exists', 'errors'),
    )
    // Списки перечитаны: второй запрос поиска уже за свежей связью.
    expect(state.searches).toHaveLength(2)
  })

  it('«Удалить из друзей» из поиска требует подтверждения с предупреждением', async () => {
    const state = searchServer([result('friend')])
    const section = await renderSearch()

    await typeQuery(section, 'anna')
    await section.findByText('anna')
    await userEvent.click(section.getByRole('button', { name: t('search.unfriend', 'friends') }))

    const question = t('list.unfriendConfirm', 'friends').replace('{{username}}', 'anna')
    expect(section.getByText(question)).toBeInTheDocument()
    expect(state.posts).toBe(0)

    // После удаления сервер уже не считает пару дружбой — это видно перечитанным поиском.
    server.use(http.get('*/api/users/search', () => HttpResponse.json([result('none')])))
    await userEvent.click(
      section.getByRole('button', { name: t('list.unfriendConfirmYes', 'friends') }),
    )
    expect(await section.findByRole('button', { name: t('search.add', 'friends') })).toBeInTheDocument()
  })

  it('«Отозвать» снимает свою заявку', async () => {
    const state = searchServer([result('outgoing_request', '66666666-6666-6666-6666-666666666666')])
    let withdrawn = false
    server.use(
      http.delete('*/api/friends/requests/:id', () => {
        withdrawn = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const section = await renderSearch()

    await typeQuery(section, 'anna')
    await section.findByText('anna')
    await userEvent.click(section.getByRole('button', { name: t('search.withdraw', 'friends') }))

    expect(withdrawn).toBe(true)
    // Кэш сброшен: поиск перечитан за свежей связью.
    expect(state.searches).toHaveLength(2)
  })
})
