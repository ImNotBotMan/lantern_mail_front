import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enAuth from './locales/en/auth.json'
import enCity from './locales/en/city.json'
import enCommon from './locales/en/common.json'
import enErrors from './locales/en/errors.json'
import enFriends from './locales/en/friends.json'
import enLetters from './locales/en/letters.json'
import ruAuth from './locales/ru/auth.json'
import ruCity from './locales/ru/city.json'
import ruCommon from './locales/ru/common.json'
import ruErrors from './locales/ru/errors.json'
import ruFriends from './locales/ru/friends.json'
import ruLetters from './locales/ru/letters.json'

export const SUPPORTED_LANGUAGES = ['ru', 'en'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

const STORAGE_KEY = 'lantern.language'

export const NAMESPACES = ['common', 'auth', 'letters', 'friends', 'city', 'errors'] as const

export const resources = {
  ru: {
    common: ruCommon,
    auth: ruAuth,
    letters: ruLetters,
    friends: ruFriends,
    city: ruCity,
    errors: ruErrors,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    letters: enLetters,
    friends: enFriends,
    city: enCity,
    errors: enErrors,
  },
} as const

function isSupported(value: string | null | undefined): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language)
}

/**
 * localStorage может отсутствовать или быть недоступным (приватный режим, тесты, SSR).
 * Язык — не критичное состояние: без хранилища просто берём язык браузера.
 */
function readStoredLanguage(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

function storeLanguage(language: Language): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, language)
  } catch {
    // Записать некуда — выбор проживёт до перезагрузки страницы.
  }
}

/** Сохранённый выбор пользователя, иначе язык браузера, иначе ru. */
export function resolveLanguage(): Language {
  const saved = readStoredLanguage()
  if (isSupported(saved)) return saved

  const fromBrowser = globalThis.navigator?.language?.split('-')[0]
  return isSupported(fromBrowser) ? fromBrowser : 'ru'
}

export function persistLanguage(language: Language): void {
  storeLanguage(language)
  document.documentElement.lang = language
}

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(),
  fallbackLng: 'ru',
  ns: [...NAMESPACES],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
})

document.documentElement.lang = i18n.language

export default i18n
