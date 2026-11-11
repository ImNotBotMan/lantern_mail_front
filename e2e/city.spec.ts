import { expect, test } from '@playwright/test'

import { chooseCity, createUser, newUser, signIn } from './helpers'

test('без города продукт закрыт, пока город не выбран', async ({ page, request }) => {
  // Пользователь заводится через API без города: экран выбора — то, что проверяет сценарий
  const user = await createUser(request, newUser(), null)

  await signIn(page, user)
  await expect(page.getByRole('heading', { name: 'Выберите город' })).toBeVisible()

  // Прямой адрес продукта не обходит шаг выбора
  await page.goto('/inbox')
  await expect(page.getByRole('heading', { name: 'Выберите город' })).toBeVisible()

  await chooseCity(page, 'Санкт-Петербург')
  await expect(page.getByRole('heading', { name: 'Входящие' })).toBeVisible()

  // Профиль показывает выбранный город и недельный лимит смены
  await page.getByRole('link', { name: 'Аккаунт' }).click()
  await expect(page.getByText('Санкт-Петербург')).toBeVisible()
  await expect(page.getByText(/Город можно изменить с/)).toBeVisible()
})
