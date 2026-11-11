import { expect, test } from '@playwright/test'

import { createUser, signIn } from './helpers'

test('неизвестный маршрут объясняет 404 и возвращает к входящим', async ({ page, request }) => {
  const user = await createUser(request)
  await signIn(page, user)

  await page.goto('/no-such-screen')

  await expect(page.getByRole('heading', { name: 'Ничего не нашлось' })).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Входящие' }).click()
  await expect(page.getByRole('heading', { name: 'Входящие' })).toBeVisible()
})
