import { expect, test } from '@playwright/test'

import {
  API_BASE_URL,
  apiAccessToken,
  befriend,
  createUser,
  DEFAULT_CITY_ID,
  newContext,
  newUser,
  signIn,
} from './helpers'

const LETTER_BODY = 'Здравствуй, друг! Пишу тебе первым письмом.'

/**
 * Доставка не мгновенная: ожидание зависит от городов и `DELIVERY_MIN_SECONDS`/
 * `DELIVERY_MAX_SECONDS` бэкенда. С константами в пару секунд прогон занимает пару секунд,
 * с часовыми — часы, поэтому тест ждёт доставку опросом API, а не фиксированной паузой.
 */
const DELIVERY_TIMEOUT_MS = Number(process.env.E2E_DELIVERY_TIMEOUT_MS ?? 150_000)

test('письмо: запечатать, отправить, конверт у получателя, доставка и прочтение', async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(DELIVERY_TIMEOUT_MS + 60_000)

  // Разные города: путь письма виден на конверте и в самом письме
  const sender = await createUser(request, newUser(), DEFAULT_CITY_ID)
  const recipient = await createUser(request, newUser(), DEFAULT_CITY_ID + 1)
  await befriend(request, sender, recipient)

  // 1. Отправитель пишет письмо и запечатывает его. «Написать письмо» живёт в отправленных:
  // в шапку действие переедет после MVP, отдельным изменением дизайна.
  await signIn(page, sender)
  await page.getByRole('link', { name: 'Отправленные' }).click()
  await page.getByRole('link', { name: 'Написать письмо' }).click()
  await expect(page.getByRole('heading', { name: 'Новое письмо' })).toBeVisible()

  await page.getByLabel(`@${recipient.username}`).check()
  await page.getByLabel('Текст письма').fill(LETTER_BODY)
  await page.getByRole('button', { name: 'Запечатать' }).click()

  await expect(page.getByRole('heading', { name: 'Письмо' })).toBeVisible()
  await expect(page.getByText('Запечатано').first()).toBeVisible()

  // 2. Отправка спрашивает подтверждение: письмо уходит насовсем.
  await page.getByRole('button', { name: 'Отправить' }).click()
  await expect(page.getByText(/Письмо уйдёт к получателю/)).toBeVisible()
  await page.getByRole('button', { name: 'Отправить' }).click()
  await expect(page.getByText('В пути').first()).toBeVisible()

  const context = await newContext(browser)
  const recipientPage = await context.newPage()
  try {
    // 3. Получатель видит конверт: отправитель есть, текста и времени доставки нет.
    await signIn(recipientPage, recipient)
    await recipientPage.getByRole('link', { name: 'Входящие' }).click()

    await expect(recipientPage.getByRole('link', { name: sender.username })).toBeVisible()
    await expect(recipientPage.getByText(LETTER_BODY)).toHaveCount(0)

    await recipientPage.getByRole('link', { name: sender.username }).click()
    await expect(recipientPage.getByText(/Письмо в пути/)).toBeVisible()
    await expect(recipientPage.getByText('Москва → Санкт-Петербург')).toBeVisible()
    await expect(recipientPage.getByText(LETTER_BODY)).toHaveCount(0)

    // 4. Доставку определяет время: статус считается из дат, отдельного события у клиента нет.
    const token = await apiAccessToken(request, recipient)
    await expect
      .poll(
        async () => {
          const response = await request.get(`${API_BASE_URL}/letters/inbox`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const letters = (await response.json()) as { view: string }[]
          return letters[0]?.view ?? 'empty'
        },
        { timeout: DELIVERY_TIMEOUT_MS, intervals: [2000] },
      )
      .toBe('incoming')

    // 5. Доставленное письмо открывается, и само открытие фиксирует прочтение.
    await recipientPage.getByRole('link', { name: 'Входящие' }).click()
    await recipientPage.getByRole('button', { name: 'Обновить' }).click()
    await expect(recipientPage.getByText('Доставлено').first()).toBeVisible()

    await recipientPage.getByRole('link', { name: sender.username }).click()
    await expect(recipientPage.getByText(LETTER_BODY)).toBeVisible()
    await expect(recipientPage.getByText('Прочитано').first()).toBeVisible()

    // 6. Отправитель видит в отправленных, что письмо прочитано.
    await page.getByRole('link', { name: 'Отправленные' }).click()
    await expect(page.getByText('Прочитано').first()).toBeVisible()
  } finally {
    await context.close()
  }
})
