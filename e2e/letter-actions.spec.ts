import { expect, test } from '@playwright/test'

import { createUser, signIn } from './helpers'

const LETTER_BODY = 'Письмо, которое нужно удалить или распечатать.'

/** Письмо самому себе: получатель есть всегда, дружба для сценария не нужна. */
async function writeDraftToSelf(page: import('@playwright/test').Page, username: string) {
  await page.getByRole('link', { name: 'Написать письмо' }).click()
  await expect(page.getByRole('heading', { name: 'Новое письмо' })).toBeVisible()

  await page.getByLabel(`@${username} — письмо в будущее`).check()
  await page.getByLabel('Текст письма').fill(LETTER_BODY)
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByRole('heading', { name: 'Черновик' })).toBeVisible()
}

test('черновик удаляется из отправленных после подтверждения', async ({ page, request }) => {
  const user = await createUser(request)
  await signIn(page, user)

  await writeDraftToSelf(page, user.username)

  await page.getByRole('link', { name: 'Отправленные' }).click()
  await expect(page.getByText(user.username).first()).toBeVisible()

  await page.getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.getByText('Удалить письмо? Вернуть его будет нельзя.')).toBeVisible()

  await page.getByRole('button', { name: 'Удалить', exact: true }).click()

  await expect(page.getByText('Писем пока нет — начните с «Написать письмо»')).toBeVisible()
})

test('запечатанное письмо распечатывается и снова редактируется', async ({ page, request }) => {
  const user = await createUser(request)
  await signIn(page, user)

  await page.getByRole('link', { name: 'Написать письмо' }).click()
  await page.getByLabel(`@${user.username} — письмо в будущее`).check()
  await page.getByLabel('Текст письма').fill(LETTER_BODY)
  await page.getByRole('button', { name: 'Запечатать' }).click()

  await expect(page.getByRole('heading', { name: 'Письмо' })).toBeVisible()
  await expect(page.getByText('Запечатано').first()).toBeVisible()

  await page.getByRole('button', { name: 'Распечатать' }).click()

  await expect(page.getByRole('heading', { name: 'Черновик' })).toBeVisible()
  await expect(page.getByLabel('Текст письма')).toHaveValue(LETTER_BODY)
})
