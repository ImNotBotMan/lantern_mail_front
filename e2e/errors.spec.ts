import { expect, test } from '@playwright/test'

import { createUser, signIn } from './helpers'

test('отсутствующее письмо объясняет 404 и предлагает списки', async ({ page, request }) => {
  const user = await createUser(request)
  await signIn(page, user)

  // Валидный UUID, которого нет в базе: путь несуществующего письма — 404, а не 422
  await page.goto('/letters/00000000-0000-0000-0000-000000000000')

  await expect(page.getByRole('heading', { name: 'Письмо' })).toBeVisible()
  await expect(
    page.getByText('Письма нет: возможно, его удалили или ссылка устарела'),
  ).toBeVisible()
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'Входящие' })).toBeVisible()
  await expect(main.getByRole('link', { name: 'Отправленные' })).toBeVisible()

  await main.getByRole('link', { name: 'Отправленные' }).click()
  await expect(page.getByRole('heading', { name: 'Отправленные' })).toBeVisible()
})
