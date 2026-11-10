/** Адреса модуля писем: один источник для ссылок и переходов после действий. */
export const lettersPaths = {
  sent: '/sent',
  inbox: '/inbox',
  newLetter: '/letters/new',
  letter: (id: string) => `/letters/${id}`,
  editLetter: (id: string) => `/letters/${id}/edit`,
  friends: '/friends',
} as const
