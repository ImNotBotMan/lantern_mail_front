import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type {
  ConversationCard,
  ConversationFeed,
  IncomingLetter,
  IncomingLetterPreview,
  LetterCreate,
  LetterEvent,
  LetterResponse,
} from '../../api/types'
import {
  annaChat,
  borisChat,
  chatSocket,
  envelope,
  feedOf,
  incomingLetter,
  letter,
  me,
  readIncomingLetter,
  selfChat,
  transitLetter,
} from '../../test/msw/handlers'
import { server } from '../../test/msw/server'
import { renderAt } from '../../test/render'
import { signInForTest } from '../../test/session'
import { t } from '../../test/i18n'

const label = (key: string) => t(key, 'chats')

const fromAnna: IncomingLetter = {
  ...readIncomingLetter,
  sender_username: 'anna',
  body: 'Ответ от Анны',
}
const toAnna: LetterResponse = { ...transitLetter, body: 'Письмо Анне' }
const flyingFromAnna: IncomingLetterPreview = { ...envelope, sender_username: 'anna' }

function chatsServer(items: ConversationCard[]) {
  server.use(http.get('*/api/conversations', () => HttpResponse.json({ items })))
}

/** Лента по курсору: ключ — значение `before`, пустая строка — первая страница. */
function feedServer(pages: Record<string, ConversationFeed>) {
  const state = { cursors: [] as (string | null)[] }
  server.use(
    http.get('*/api/conversations/:id/letters', ({ request }) => {
      const before = new URL(request.url).searchParams.get('before')
      state.cursors.push(before)
      const page = pages[before ?? '']
      return page
        ? HttpResponse.json(page)
        : HttpResponse.json({ error: 'not_found', message: 'Not found' }, { status: 404 })
    }),
  )
  return state
}

/** Сервер отправки: запоминает шаги и отдаёт письмо с тем текстом, что пришёл. */
function sendServer() {
  const state = { steps: [] as string[], failSend: false }
  let created: LetterResponse = letter

  server.use(
    http.post('*/api/letters', async ({ request }) => {
      const data = (await request.json()) as LetterCreate
      state.steps.push(`create:${data.recipient_username ?? ''}:${data.body ?? ''}`)
      created = {
        ...letter,
        recipient_username: data.recipient_username ?? null,
        body: data.body ?? '',
      }
      return HttpResponse.json(created, { status: 201 })
    }),
    http.post('*/api/letters/:id/seal', () => {
      state.steps.push('seal')
      created = { ...created, status: 'sealed' }
      return HttpResponse.json(created)
    }),
    http.post('*/api/letters/:id/send', () => {
      state.steps.push('send')
      if (state.failSend) {
        return HttpResponse.json({ error: 'not_friends', message: 'Not friends' }, { status: 409 })
      }
      return HttpResponse.json({ ...created, status: 'in_transit' })
    }),
  )

  return state
}

/** Клиент шины на стороне MSW: тест шлёт событие ровно своему сокету. */
function socketServer() {
  const socket: { client: { send(data: string): void } | null } = { client: null }
  server.use(
    chatSocket.addEventListener('connection', ({ client }) => {
      socket.client = client
    }),
  )
  return socket
}

async function renderChat(card: ConversationCard) {
  await signInForTest()
  renderAt(`/chats/${card.id}`)
}

const composerField = () => screen.findByRole('textbox', { name: label('composer.label') })
const sendButton = () => screen.getByRole('button', { name: label('composer.send') })

describe('список чатов', () => {
  it('держит порядок сервера: «Себе» в конце, летящее без текста, замороженный помечен', async () => {
    chatsServer([annaChat, borisChat, selfChat])
    await signInForTest()
    renderAt('/chats')

    expect(await screen.findByRole('heading', { name: label('list.title') })).toBeInTheDocument()
    const list = within(await screen.findByRole('list'))
    const titles = list.getAllByRole('link').map((link) => link.textContent)
    expect(titles).toEqual(['anna', 'boris', label('chat.self')])

    const anna = list.getByRole('link', { name: 'anna' })
    expect(anna).toHaveAttribute('href', `/chats/${annaChat.id}`)
    expect(list.getByText('Привет')).toBeInTheDocument()
    expect(list.getByText(label('list.inTransit'))).toBeInTheDocument()
    expect(list.getAllByText(label('list.frozen'))).toHaveLength(1)
  })

  it('пустой список — не ошибка', async () => {
    chatsServer([])
    await signInForTest()
    renderAt('/chats')

    expect(await screen.findByText(label('list.empty'))).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('ошибку загрузки показывает с «Повторить»', async () => {
    let attempts = 0
    server.use(
      http.get('*/api/conversations', () => {
        attempts += 1
        if (attempts === 1) return HttpResponse.error()
        return HttpResponse.json({ items: [annaChat] })
      }),
    )
    await signInForTest()
    renderAt('/chats')

    expect(await screen.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))
    await userEvent.click(screen.getByRole('button', { name: t('actions.retry', 'common') }))

    expect(await screen.findByRole('link', { name: 'anna' })).toBeInTheDocument()
  })

  it('пункт «Чаты» есть в меню', async () => {
    await signInForTest()
    renderAt('/inbox')

    const link = await screen.findByRole('link', { name: t('nav.chats', 'common') })
    expect(link).toHaveAttribute('href', '/chats')
  })
})

describe('лента диалога', () => {
  it('показывает письма целиком сверху вниз, летящее чужое — конвертом без текста', async () => {
    feedServer({ '': feedOf(annaChat, [flyingFromAnna, fromAnna, toAnna]) })
    await renderChat(annaChat)

    expect(await screen.findByRole('heading', { name: 'anna' })).toBeInTheDocument()
    const articles = await screen.findAllByRole('article')
    expect(articles).toHaveLength(3)

    // Сервер отдаёт новые вперёд, а лента читается от ранних к последнему.
    expect(articles[0]).toHaveTextContent(toAnna.body)
    expect(articles[0]).toHaveTextContent(t('status.in_transit', 'letters'))
    expect(articles[1]).toHaveTextContent(fromAnna.body)
    expect(articles[2]).toHaveTextContent(t('letter.inTransitHint', 'letters'))
    expect(articles[2]).not.toHaveTextContent(t('when.deliver', 'letters'))

    expect(await composerField()).toBeInTheDocument()
  })

  it('«Показать более ранние» подгружает страницу по курсору, пока он есть', async () => {
    const state = feedServer({
      '': feedOf(annaChat, [fromAnna], 'cursor-1'),
      'cursor-1': feedOf(annaChat, [toAnna], null),
    })
    await renderChat(annaChat)

    expect(await screen.findByText(fromAnna.body)).toBeInTheDocument()
    expect(screen.queryByText(toAnna.body)).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: label('chat.earlier') }))

    expect(await screen.findByText(toAnna.body)).toBeInTheDocument()
    expect(state.cursors).toEqual([null, 'cursor-1'])
    expect(screen.queryByRole('button', { name: label('chat.earlier') })).toBeNull()
    expect(screen.getAllByRole('article')[0]).toHaveTextContent(toAnna.body)
  })

  it('пустая лента — приглашение написать, а не ошибка', async () => {
    feedServer({ '': feedOf(annaChat) })
    await renderChat(annaChat)

    expect(await screen.findByText(label('chat.empty'))).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(await composerField()).toBeInTheDocument()
  })

  it('чужой или несуществующий чат объясняет 404 и ведёт к списку', async () => {
    feedServer({})
    await renderChat(annaChat)

    expect(await screen.findByText(label('chat.missing'))).toBeInTheDocument()
    const back = screen.getByRole('link', { name: label('chat.back') })
    expect(back).toHaveAttribute('href', '/chats')
    expect(screen.queryByRole('button', { name: t('actions.retry', 'common') })).toBeNull()
  })

  it('ошибку загрузки ленты показывает с «Повторить»', async () => {
    let attempts = 0
    server.use(
      http.get('*/api/conversations/:id/letters', () => {
        attempts += 1
        if (attempts === 1) return HttpResponse.error()
        return HttpResponse.json(feedOf(annaChat, [fromAnna]))
      }),
    )
    await renderChat(annaChat)

    expect(await screen.findByRole('alert')).toHaveTextContent(t('network_error', 'errors'))
    await userEvent.click(screen.getByRole('button', { name: t('actions.retry', 'common') }))

    expect(await screen.findByText(fromAnna.body)).toBeInTheDocument()
  })

  it('показ доставленного письма отмечает его прочитанным ровно один раз', async () => {
    const delivered: IncomingLetter = { ...incomingLetter, sender_username: 'anna' }
    const state = feedServer({ '': feedOf(annaChat, [delivered, fromAnna, flyingFromAnna]) })
    const reads: string[] = []
    server.use(
      http.post('*/api/letters/:id/read', ({ params }) => {
        reads.push(String(params.id))
        return HttpResponse.json({ ...delivered, status: 'read', read_at: '2026-01-05T12:05:00Z' })
      }),
    )
    await renderChat(annaChat)

    expect(await screen.findByText(delivered.body)).toBeInTheDocument()
    await waitFor(() => expect(reads).toEqual([delivered.id]))
    // Прочтение перечитывает ленту, но повторного запроса это не вызывает.
    await waitFor(() => expect(state.cursors).toHaveLength(2))
    expect(reads).toEqual([delivered.id])
  })
})

describe('композер', () => {
  it('отправляет письмо одним действием: создать → запечатать → отправить', async () => {
    const state = sendServer()
    const feed = feedServer({ '': feedOf(annaChat, [fromAnna]) })
    await renderChat(annaChat)

    const field = await composerField()
    await userEvent.type(field, 'Как дела?')
    await userEvent.click(sendButton())

    await waitFor(() => expect(state.steps).toEqual(['create:anna:Как дела?', 'seal', 'send']))
    await waitFor(() => expect(field).toHaveValue(''))
    // Лента перечитана после отправки.
    await waitFor(() => expect(feed.cursors).toHaveLength(2))
  })

  it('в чате «Себе» письмо уходит самому пользователю', async () => {
    const state = sendServer()
    feedServer({ '': feedOf(selfChat) })
    await renderChat(selfChat)

    expect(await screen.findByRole('heading', { name: label('chat.self') })).toBeInTheDocument()
    await userEvent.type(await composerField(), 'Себе в будущее')
    await userEvent.click(sendButton())

    const expected = [`create:${me.username ?? ''}:Себе в будущее`, 'seal', 'send']
    await waitFor(() => expect(state.steps).toEqual(expected))
  })

  it('ошибку показывает в композере, а повтор продолжает то же письмо', async () => {
    const state = sendServer()
    state.failSend = true
    feedServer({ '': feedOf(annaChat) })
    await renderChat(annaChat)

    const field = await composerField()
    await userEvent.type(field, 'Привет')
    await userEvent.click(sendButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(t('not_friends', 'errors'))
    expect(field).toHaveValue('Привет')

    state.failSend = false
    await userEvent.click(sendButton())

    const expected = ['create:anna:Привет', 'seal', 'send', 'send']
    await waitFor(() => expect(state.steps).toEqual(expected))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('повторный клик во время отправки второго письма не создаёт', async () => {
    const state = sendServer()
    const gate = { open: () => {} }
    const opened = new Promise<void>((resolve) => {
      gate.open = resolve
    })
    server.use(
      http.post('*/api/letters', async ({ request }) => {
        const data = (await request.json()) as LetterCreate
        state.steps.push(`create:${data.recipient_username ?? ''}`)
        await opened
        return HttpResponse.json({ ...letter, body: data.body ?? '' }, { status: 201 })
      }),
    )
    feedServer({ '': feedOf(annaChat) })
    await renderChat(annaChat)

    await userEvent.type(await composerField(), 'Один раз')
    await userEvent.click(sendButton())
    const sending = await screen.findByRole('button', { name: label('composer.sending') })
    expect(sending).toBeDisabled()
    await userEvent.click(sending)
    gate.open()

    await waitFor(() => expect(state.steps).toEqual(['create:anna', 'seal', 'send']))
  })

  it('замороженный чат читается, но композера нет', async () => {
    feedServer({ '': feedOf(borisChat, [envelope]) })
    await renderChat(borisChat)

    expect(await screen.findByText(label('chat.frozen'))).toBeInTheDocument()
    expect(screen.getByRole('article')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: label('composer.label') })).toBeNull()
  })
})

describe('realtime', () => {
  it('событие шины перезапрашивает открытую ленту', async () => {
    const socket = socketServer()
    const newer: IncomingLetter = {
      ...fromAnna,
      id: '77777777-7777-7777-7777-777777777777',
      body: 'Только что долетело',
    }
    const pages = { '': feedOf(annaChat, [fromAnna]) }
    feedServer(pages)
    await renderChat(annaChat)
    expect(await screen.findByText(fromAnna.body)).toBeInTheDocument()
    await waitFor(() => expect(socket.client).not.toBeNull())

    pages[''] = feedOf(annaChat, [newer, fromAnna])
    const event: LetterEvent = {
      type: 'letter.delivered',
      letter_id: newer.id,
      conversation_id: annaChat.id,
      sender_id: 2,
      recipient_id: me.id,
      at: '2026-01-08T12:00:00Z',
    }
    socket.client?.send(JSON.stringify(event))

    expect(await screen.findByText(newer.body)).toBeInTheDocument()
  })

  it('событие обновляет список, повтор безвреден', async () => {
    const socket = socketServer()
    const lists = { current: [annaChat] }
    server.use(http.get('*/api/conversations', () => HttpResponse.json({ items: lists.current })))
    await signInForTest()
    renderAt('/chats')
    expect(await screen.findByRole('link', { name: 'anna' })).toBeInTheDocument()
    await waitFor(() => expect(socket.client).not.toBeNull())

    lists.current = [annaChat, selfChat]
    const event: LetterEvent = {
      type: 'letter.read',
      letter_id: letter.id,
      conversation_id: annaChat.id,
      sender_id: me.id,
      recipient_id: 2,
      at: '2026-01-08T12:00:00Z',
    }
    socket.client?.send(JSON.stringify(event))
    socket.client?.send(JSON.stringify(event))

    expect(await screen.findByRole('link', { name: label('chat.self') })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'anna' })).toHaveLength(1)
  })
})
