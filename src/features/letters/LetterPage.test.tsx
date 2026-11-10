import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { AnyLetter } from '../../api/types'
import i18n from '../../shared/i18n'
import { formatDate } from '../../shared/i18n/formatDate'
import { envelope, incomingLetter, sealedLetter, transitLetter } from '../../test/msw/handlers'
import { server } from '../../test/msw/server'
import { renderAt } from '../../test/render'
import { signInForTest } from '../../test/session'
import { t } from '../../test/i18n'

const label = (key: string) => t(key, 'letters')

/** Сервер отдаёт одно письмо: форма ответа — та, что задана фикстурой. */
function singleLetterServer(letter: AnyLetter) {
  server.use(
    http.get('*/api/letters/sent', () => HttpResponse.json([])),
    http.get('*/api/letters/:id', ({ params }) =>
      String(params.id) === letter.id
        ? HttpResponse.json(letter)
        : HttpResponse.json({ error: 'not_found', message: 'Not found' }, { status: 404 }),
    ),
  )
}

async function renderLetter(id: string): Promise<void> {
  await signInForTest()
  renderAt(`/letters/${id}`)
  await screen.findByRole('heading', { name: label('letter.title') })
}

/** Содержимое письма ищем внутри самой статьи, а не в шапке приложения. */
async function findLetterArticle() {
  return within(await screen.findByRole('article'))
}

describe('экран письма', () => {
  it('показывает письмо отправителя целиком: текст, моменты и действия', async () => {
    singleLetterServer(transitLetter)
    await renderLetter(transitLetter.id)

    const letter = await findLetterArticle()
    expect(letter.getByText('Привет')).toBeInTheDocument()
    expect(letter.getByText(label('status.in_transit'))).toBeInTheDocument()
    expect(letter.getByText(new RegExp(label('when.sent')))).toBeInTheDocument()
    expect(letter.getByText(new RegExp(label('when.deliver')))).toBeInTheDocument()
    // Письмо в пути не редактируется и не отправляется повторно — действий нет вообще.
    expect(screen.queryByRole('button', { name: label('editor.send') })).toBeNull()
    expect(screen.queryByRole('link', { name: label('editor.edit') })).toBeNull()
  })

  it('конверт в пути показывает отправителя, но не текст и не время доставки', async () => {
    singleLetterServer(envelope)
    await renderLetter(envelope.id)

    const letter = await findLetterArticle()
    expect(
      letter.getByText(
        i18n.t('letter.from', { ns: 'letters', username: envelope.sender_username }),
      ),
    ).toBeInTheDocument()
    expect(letter.getByText(label('status.in_transit'))).toBeInTheDocument()
    expect(letter.getByText(label('letter.inTransitHint'))).toBeInTheDocument()
    expect(letter.queryByText('Привет')).toBeNull()
    expect(letter.queryByText(new RegExp(label('when.deliver')))).toBeNull()
  })

  it('доставленное письмо показывает получателю текст и дату доставки', async () => {
    singleLetterServer(incomingLetter)
    await renderLetter(incomingLetter.id)

    const letter = await findLetterArticle()
    expect(letter.getByText('Привет')).toBeInTheDocument()
    // Слово статуса и подпись даты совпадают — проверяем сам момент доставки.
    expect(letter.getByText(formatDate(incomingLetter.delivered_at, i18n.language))).toBeInTheDocument()
  })

  it('отсутствующее письмо объясняет 404 и предлагает списки', async () => {
    singleLetterServer(transitLetter)
    await renderLetter('missing-id')

    const main = within(screen.getByRole('main'))
    expect(main.getByText(label('letter.missing'))).toBeInTheDocument()
    expect(main.getByRole('link', { name: label('inbox.title') })).toBeInTheDocument()
    expect(main.getByRole('link', { name: label('sent.title') })).toBeInTheDocument()
  })

  it('409 при отправке показывает ошибку и оставляет письмо на месте', async () => {
    server.use(
      http.get('*/api/letters/:id', () => HttpResponse.json(sealedLetter)),
      http.post('*/api/letters/:id/send', () =>
        HttpResponse.json({ error: 'not_friends', message: 'Not a friend' }, { status: 409 }),
      ),
    )
    await renderLetter(sealedLetter.id)

    await userEvent.click(await screen.findByRole('button', { name: label('editor.send') }))
    await userEvent.click(screen.getByRole('button', { name: label('editor.sendConfirmYes') }))

    expect(await screen.findByText(t('not_friends', 'errors'))).toBeInTheDocument()
    const letter = within(screen.getByRole('article'))
    expect(
      letter.getByText(formatDate(sealedLetter.sealed_at ?? sealedLetter.created_at, i18n.language)),
    ).toBeInTheDocument()
  })
})
