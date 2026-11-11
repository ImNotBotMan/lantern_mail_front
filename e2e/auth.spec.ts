import { expect, test } from '@playwright/test'

import { chooseCity, createUser, newUser, signIn } from './helpers'

test('анонимного уводит на вход и после входа возвращает на запрошенный адрес', async ({
  page,
  request,
}) => {
  const user = await createUser(request)

  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible()

  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Пароль').fill(user.password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Аккаунт' })).toBeVisible()
  await expect(page.getByText(user.username)).toBeVisible()
})

test('регистрация ведёт к выбору города, потом в приложение', async ({ page }) => {
  const user = newUser()

  await page.goto('/register')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Имя').fill(user.username)
  await page.getByLabel('Пароль').fill(user.password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()

  await chooseCity(page, 'Санкт-Петербург')
  await expect(page.getByRole('heading', { name: 'Входящие' })).toBeVisible()

  await page.getByRole('link', { name: 'Аккаунт' }).click()
  await expect(page.getByText(user.username)).toBeVisible()
})

test('неверный пароль показывается под полем', async ({ page, request }) => {
  const user = await createUser(request)

  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Пароль').fill('wrong-password')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()

  await expect(page.getByText('Неверный email или пароль')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible()
})

test('выход закрывает сессию и после перезагрузки', async ({ page, request }) => {
  const user = await createUser(request)
  await signIn(page, user)
  await expect(page.getByRole('heading', { name: 'Входящие' })).toBeVisible()

  await page.getByRole('link', { name: 'Аккаунт' }).click()
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible()
})
