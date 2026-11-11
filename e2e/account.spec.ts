import { expect, test } from '@playwright/test'

import { createUser, signIn } from './helpers'

test('аккаунт показывает имя, дату создания и оба выхода', async ({ page, request }) => {
  const user = await createUser(request)
  await signIn(page, user)

  await page.getByRole('link', { name: 'Аккаунт' }).click()

  await expect(page.getByRole('heading', { name: 'Аккаунт' })).toBeVisible()
  await expect(page.getByText(user.username)).toBeVisible()
  await expect(page.getByText('Аккаунт создан')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Выйти на всех устройствах' })).toBeVisible()
})
