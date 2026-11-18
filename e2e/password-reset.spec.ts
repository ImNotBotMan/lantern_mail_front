import { expect, test } from '@playwright/test'

/**
 * Сброс пароля целиком на живом бэкенде: письмо шлёт Firebase, а ответ 204 одинаков для
 * известного и неизвестного адреса — восстановление не раскрывает аккаунты.
 */
test('со входа запрашивает восстановление пароля и видит подтверждение', async ({ page }) => {
  await page.goto('/login')

  await page.getByRole('link', { name: 'Забыли пароль?' }).click()
  await expect(page.getByRole('heading', { name: 'Восстановление пароля' })).toBeVisible()

  await page.getByLabel('Email').fill('nobody.here@example.com')
  await page.getByRole('button', { name: 'Отправить ссылку' }).click()

  await expect(page.getByRole('heading', { name: 'Письмо отправлено' })).toBeVisible()
  await expect(page.getByText(/nobody\.here@example\.com/)).toBeVisible()
  // Форма ушла: повторная отправка живёт на экране подтверждения и ждёт минуту
  await expect(page.getByLabel('Email')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Отправить ещё раз' })).toHaveCount(0)
  await expect(page.getByText(/Повторная отправка через \d+ с/)).toBeVisible()
})
