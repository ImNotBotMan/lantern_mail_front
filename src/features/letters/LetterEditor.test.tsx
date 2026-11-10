import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { AnyLetter, LetterCreate, LetterResponse, LetterUpdate } from '../../api/types'
import i18n from '../../shared/i18n'
import { letter as draftLetter } from '../../test/msw/handlers'
import { server } from '../../test/msw/server'
import { renderAt } from '../../test/render'
import { signInForTest } from '../../test/session'
import { t } from '../../test/i18n'

const label = (key: string) => t(key, 'letters')

/**
 * Сервер писем в памяти: черновик создаётся первым сохранением, запечатывание меняет
 * ту же запись, поэтому экран письма видит то, что только что сделал редактор.
 */
function editorServer(initial: LetterResponse | null = null) {
  const state = {
    byId: new Map<string, AnyLetter>(),
    created: [] as LetterCreate[],
    patches: [] as LetterUpdate[],
    seals: [] as string[],
  }
  if (initial) state.byId.set(initial.id, initial)

  const notFound = () =>
    HttpResponse.json({ error: 'not_found', message: 'Not found' }, { status: 404 })

  server.use(
    http.get('*/api/letters/sent', () => HttpResponse.json([])),
    http.get('*/api/letters/:id', ({ params }) => {
      const found = state.byId.get(String(params.id))
      return found ? HttpResponse.json(found) : notFound()
    }),
    http.post('*/api/letters', async ({ request }) => {
      const data = (await request.json()) as LetterCreate
      state.created.push(data)
      const created: LetterResponse = {
        ...draftLetter,
        id: 'created-1',
        recipient_username: data.recipient_username ?? null,
        body: data.body ?? '',
      }
      state.byId.set(created.id, created)
      return HttpResponse.json(created, { status: 201 })
    }),
    http.patch('*/api/letters/:id', async ({ params, request }) => {
      const data = (await request.json()) as LetterUpdate
      state.patches.push(data)
      const current = state.byId.get(String(params.id))
      if (!current) return notFound()
      const updated = {
        ...current,
        recipient_username: data.recipient_username ?? null,
        body: data.body ?? '',
      } as AnyLetter
      state.byId.set(updated.id, updated)
      return HttpResponse.json(updated)
    }),
    http.post('*/api/letters/:id/seal', ({ params }) => {
      const id = String(params.id)
      state.seals.push(id)
      const current = state.byId.get(id)
      if (!current) return notFound()
      const sealed = { ...current, status: 'sealed', sealed_at: '2026-01-02T12:00:00Z' } as AnyLetter
      state.byId.set(id, sealed)
      return HttpResponse.json(sealed)
    }),
  )

  return state
}

const bodyField = () => screen.getByLabelText(label('editor.body'))

async function renderNewLetter() {
  await signInForTest()
  renderAt('/letters/new')
  await screen.findByRole('heading', { name: label('editor.title') })
}

async function chooseRecipient(username: string) {
  await userEvent.click(await screen.findByLabelText(username))
}

describe('редактор письма', () => {
  it('предлагает друзей и самого автора', async () => {
    editorServer()
    await renderNewLetter()

    expect(await screen.findByLabelText('@anna')).toBeInTheDocument()
    expect(
      screen.getByLabelText(
        i18n.t('editor.selfOption', { ns: 'letters', username: '@me_user' }),
      ),
    ).toBeInTheDocument()
  })

  it('сохраняет черновик и уводит в него же по адресу с id', async () => {
    const state = editorServer()
    await renderNewLetter()

    const save = screen.getByRole('button', { name: label('editor.save') })
    expect(save).toBeDisabled()

    await chooseRecipient('@anna')
    await userEvent.type(bodyField(), 'Привет')
    expect(save).toBeEnabled()

    await userEvent.click(save)

    expect(
      await screen.findByRole('heading', { name: label('editor.editTitle') }),
    ).toBeInTheDocument()
    expect(state.created).toEqual([{ recipient_username: 'anna', body: 'Привет' }])
    expect(bodyField()).toHaveValue('Привет')
    expect(screen.getByLabelText('@anna')).toBeChecked()
  })

  it('запечатывает только письмо с получателем и текстом, затем открывает его', async () => {
    const state = editorServer()
    await renderNewLetter()

    const seal = screen.getByRole('button', { name: label('editor.seal') })
    expect(seal).toBeDisabled()

    await chooseRecipient('@anna')
    expect(seal).toBeDisabled()

    await userEvent.type(bodyField(), 'Привет')
    expect(seal).toBeEnabled()

    await userEvent.click(seal)

    expect(
      await screen.findByRole('heading', { name: label('letter.title') }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Привет')).toBeInTheDocument()
    expect(state.seals).toEqual(['created-1'])
  })

  it('заполняет поля сохранённым черновиком', async () => {
    editorServer(draftLetter)
    await signInForTest()
    renderAt(`/letters/${draftLetter.id}/edit`)

    expect(
      await screen.findByRole('heading', { name: label('editor.editTitle') }),
    ).toBeInTheDocument()
    expect(bodyField()).toHaveValue('Привет')
    expect(screen.getByLabelText('@anna')).toBeChecked()
  })

  it('просит подтверждение, прежде чем уйти с несохранённым текстом', async () => {
    editorServer()
    await renderNewLetter()
    await userEvent.type(bodyField(), 'Привет')

    const friendsLink = screen.getByRole('link', { name: t('nav.friends', 'common') })
    await userEvent.click(friendsLink)

    expect(await screen.findByText(label('editor.unsaved'))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: label('editor.unsavedStay') }))
    expect(screen.getByRole('heading', { name: label('editor.title') })).toBeInTheDocument()
    expect(bodyField()).toHaveValue('Привет')

    await userEvent.click(friendsLink)
    await userEvent.click(await screen.findByRole('button', { name: label('editor.unsavedLeave') }))

    expect(
      await screen.findByRole('heading', { name: t('title', 'friends') }),
    ).toBeInTheDocument()
  })
})
