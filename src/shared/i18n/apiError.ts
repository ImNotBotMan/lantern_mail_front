import { ApiError } from '../../api/errors'
import i18n from './index'

/** Коды ошибок контракта лежат отдельным пространством имён, а не внутри `common`. */
export const ERROR_NAMESPACE = 'errors'

/** Ключ перевода для кода ошибки или `null`, если перевода нет. */
function errorKey(code: string): string | null {
  return i18n.exists(code, { ns: ERROR_NAMESPACE }) ? code : null
}

/**
 * Текст ошибки по коду из контракта. `message` сервера показывается только тогда, когда для
 * кода нет перевода (docs/specs/api-contract.md, «Коды ошибок»).
 */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return i18n.t('unknown', { ns: ERROR_NAMESPACE })
  const key = errorKey(error.code)
  return key ? i18n.t(key, { ns: ERROR_NAMESPACE }) : error.message
}
