/**
 * Дата в текущей локали через `Intl`: формат не собирается руками
 * (docs/specs/module-front-i18n-ui.md). По умолчанию — длинный стиль с месяцем.
 */
export function formatDate(
  value: string,
  language: string,
  dateStyle: Intl.DateTimeFormatOptions['dateStyle'] = 'long',
): string {
  return new Intl.DateTimeFormat(language, { dateStyle }).format(new Date(value))
}
