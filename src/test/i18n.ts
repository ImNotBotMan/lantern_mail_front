import i18n from '../shared/i18n'

/** Текст по ключу в текущем языке теста: тесты не зависят от локали окружения. */
export function t(key: string, ns = 'auth'): string {
  return i18n.t(key, { ns })
}
