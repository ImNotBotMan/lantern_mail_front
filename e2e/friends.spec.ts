import { expect, test } from '@playwright/test'

import { befriend, createUser, signIn } from './helpers'

test('список друзей показывает друга и удаляет его только после подтверждения', async ({
  page,
  request,
}) => {
  const me = await createUser(request)
  const friend = await createUser(request)
  await befriend(request, me, friend)

  await signIn(page, me)
  await expect(page.getByRole('heading', { name: 'Входящие' })).toBeVisible()
  await page.getByRole('link', { name: 'Друзья' }).click()

  await expect(page.getByText(friend.username)).toBeVisible()
  await expect(page.getByText(/друзья с/)).toBeVisible()

  await page.getByRole('button', { name: 'Удалить из друзей' }).click()
  await expect(page.getByText(/Летящие письма этой пары будут отменены/)).toBeVisible()

  await page.getByRole('button', { name: 'Отмена' }).click()
  await expect(page.getByText(friend.username)).toBeVisible()

  await page.getByRole('button', { name: 'Удалить из друзей' }).click()
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()

  await expect(page.getByText('Пока ни одного друга')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Пока ни одного друга')).toBeVisible()
})

test('у нового пользователя список друзей пуст', async ({ page, request }) => {
  const me = await createUser(request)
  await signIn(page, me)

  await page.getByRole('link', { name: 'Друзья' }).click()

  await expect(page.getByText('Пока ни одного друга')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
