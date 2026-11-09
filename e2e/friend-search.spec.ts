import { expect, test, type Page } from '@playwright/test'

import { createUser, newContext, signIn } from './helpers'

/** Секция экрана по заголовку: на странице три списка, запросы скоупим по своему. */
function section(page: Page, title: string) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: title }) })
}

test('поиск находит пользователя, дружба складывается через заявки в UI', async ({
  page,
  browser,
  request,
}) => {
  const me = await createUser(request)
  const other = await createUser(request)

  await signIn(page, me)
  await page.getByRole('link', { name: 'Друзья' }).click()

  const search = section(page, 'Найти по имени')
  await search.getByLabel('Найти по имени').fill(other.username)

  const row = search.locator('li').filter({ hasText: other.username })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Добавить в друзья' }).click()

  // Связь рисуется по ответу сервера: заявка ушла — действие сменилось.
  await expect(row.getByText('Заявка отправлена')).toBeVisible()
  await expect(row.getByRole('button', { name: 'Отозвать' })).toBeVisible()

  // Второй пользователь принимает заявку в своём браузере.
  const context = await newContext(browser)
  const otherPage = await context.newPage()
  try {
    await signIn(otherPage, other)
    await otherPage.getByRole('link', { name: 'Друзья' }).click()

    const incoming = section(otherPage, 'Заявки ко мне')
    await expect(incoming.getByText(me.username)).toBeVisible()
    await incoming.getByRole('button', { name: 'Принять' }).click()

    const friends = section(otherPage, 'Мои друзья')
    await expect(friends.getByText(me.username)).toBeVisible()
  } finally {
    await context.close()
  }

  // У первого пользователя дружба появляется после обновления экрана.
  await page.reload()
  const meFriends = section(page, 'Мои друзья')
  await expect(meFriends.getByText(other.username)).toBeVisible()

  // Поиск теперь показывает связь «друзья» с её действием.
  const meSearch = section(page, 'Найти по имени')
  await meSearch.getByLabel('Найти по имени').fill(other.username)
  const meRow = meSearch.locator('li').filter({ hasText: other.username })
  await expect(meRow.getByRole('button', { name: 'Удалить из друзей' })).toBeVisible()
})

test('свою заявку можно отозвать из поиска', async ({ page, request }) => {
  const me = await createUser(request)
  const other = await createUser(request)

  await signIn(page, me)
  await page.getByRole('link', { name: 'Друзья' }).click()

  const search = section(page, 'Найти по имени')
  await search.getByLabel('Найти по имени').fill(other.username)

  const row = search.locator('li').filter({ hasText: other.username })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Добавить в друзья' }).click()
  await expect(row.getByRole('button', { name: 'Отозвать' })).toBeVisible()

  await row.getByRole('button', { name: 'Отозвать' }).click()

  // Пара вернулась в «нет связи»: снова доступно добавление.
  await expect(row.getByRole('button', { name: 'Добавить в друзья' })).toBeVisible()
})
