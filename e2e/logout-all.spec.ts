import { expect, test } from '@playwright/test'

import { createUser, newContext, signIn } from './helpers'

test('выход на всех отзывает сессию на другом устройстве', async ({ browser, request }) => {
  const user = await createUser(request)
  const first = await newContext(browser)
  const second = await newContext(browser)

  try {
    const firstPage = await first.newPage()
    const secondPage = await second.newPage()

    await signIn(firstPage, user)
    await expect(firstPage.getByRole('heading', { name: 'Входящие' })).toBeVisible()

    await signIn(secondPage, user)
    await expect(secondPage.getByRole('heading', { name: 'Входящие' })).toBeVisible()

    await firstPage.getByRole('link', { name: 'Аккаунт' }).click()
    await firstPage.getByRole('button', { name: 'Выйти на всех устройствах' }).click()
    await expect(
      firstPage.getByText('Отозвать сессии на всех устройствах, включая мобильные?'),
    ).toBeVisible()
    await firstPage.getByRole('button', { name: 'Да, выйти на всех' }).click()
    await expect(firstPage.getByRole('heading', { name: 'Вход' })).toBeVisible()

    // Второе устройство при следующей проверке сессии получает отказ refresh-токена.
    await secondPage.reload()
    await expect(secondPage.getByRole('heading', { name: 'Вход' })).toBeVisible()
  } finally {
    await first.close()
    await second.close()
  }
})
