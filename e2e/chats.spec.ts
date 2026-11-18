import { expect, test } from '@playwright/test'

import {
  befriend,
  createUser,
  DEFAULT_CITY_ID,
  newContext,
  newUser,
  sendLetter,
  signIn,
} from './helpers'

const FIRST_LETTER = 'Первое письмо: с него начинается наш чат.'
const REPLY = 'Отвечаю прямо из чата!'

/** Доставку ждём так же, как в сценарии писем: время зависит от настроек бэкенда. */
const DELIVERY_TIMEOUT_MS = Number(process.env.E2E_DELIVERY_TIMEOUT_MS ?? 150_000)

test('чат: лента, ответ из композера, конверт у собеседника и realtime-доставка', async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(DELIVERY_TIMEOUT_MS * 2 + 60_000)

  const sender = await createUser(request, newUser(), DEFAULT_CITY_ID)
  const recipient = await createUser(request, newUser(), DEFAULT_CITY_ID + 1)
  await befriend(request, sender, recipient)
  await sendLetter(request, sender, recipient, FIRST_LETTER)

  // 1. Отправитель находит диалог в «Чатах» и видит своё письмо целиком.
  await signIn(page, sender)
  await page.getByRole('link', { name: 'Чаты' }).click()
  await expect(page.getByRole('heading', { name: 'Чаты' })).toBeVisible()
  await page.getByRole('link', { name: recipient.username }).click()

  await expect(page.getByRole('heading', { name: recipient.username })).toBeVisible()
  await expect(page.getByText(FIRST_LETTER)).toBeVisible()

  // 2. Ответ из композера: письмо запечатывается и уходит одной кнопкой, лента обновляется.
  await page.getByRole('textbox', { name: 'Новое письмо' }).fill(REPLY)
  await page.getByRole('button', { name: 'Отправить' }).click()
  await expect(page.getByText(REPLY)).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Новое письмо' })).toHaveValue('')

  const context = await newContext(browser)
  const recipientPage = await context.newPage()
  try {
    // 3. Собеседник видит диалог, но летящие письма — только конвертами, без текста.
    await signIn(recipientPage, recipient)
    await recipientPage.getByRole('link', { name: 'Чаты' }).click()
    await recipientPage.getByRole('link', { name: sender.username }).click()

    await expect(recipientPage.getByRole('heading', { name: sender.username })).toBeVisible()
    await expect(recipientPage.getByText(/Письмо в пути/).first()).toBeVisible()
    await expect(recipientPage.getByText(FIRST_LETTER)).toHaveCount(0)
    await expect(recipientPage.getByText(REPLY)).toHaveCount(0)

    // 4. Доставку экран получает событием шины — без перезагрузки и без «Обновить».
    await expect(recipientPage.getByText(FIRST_LETTER)).toBeVisible({
      timeout: DELIVERY_TIMEOUT_MS,
    })
    await expect(recipientPage.getByText(REPLY)).toBeVisible({ timeout: DELIVERY_TIMEOUT_MS })

    // 5. Показ доставленного в ленте — это прочтение: отправитель видит его тоже событием.
    await expect(recipientPage.getByText('Прочитано').first()).toBeVisible()
    await expect(page.getByText('Прочитано').first()).toBeVisible({ timeout: 30_000 })
  } finally {
    await context.close()
  }
})
