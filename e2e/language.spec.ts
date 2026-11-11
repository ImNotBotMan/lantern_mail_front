import { expect, test } from '@playwright/test'

import { createUser, signIn } from './helpers'

test('язык переключается на входе и сохраняется', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible()

  await page.getByLabel('Язык').selectOption('en')

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

  await page.getByLabel('Language').selectOption('ru')
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible()
})

test('язык переключается в шапке и сохраняется', async ({ page, request }) => {
  const user = await createUser(request)
  await signIn(page, user)

  await expect(page.getByRole('heading', { name: 'Входящие' })).toBeVisible()

  await page.getByLabel('Язык').selectOption('en')

  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()

  await page.getByLabel('Language').selectOption('ru')
  await expect(page.getByRole('heading', { name: 'Входящие' })).toBeVisible()
})
