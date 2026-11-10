import type { TFunction } from 'i18next'

import type { IncomingLetter, IncomingLetterView, LetterResponse } from '../../api'
import { formatDate } from '../../shared/i18n/formatDate'

export interface LetterDate {
  label: string
  value: string
}

type Moment = 'created' | 'sealed' | 'sent' | 'deliver' | 'delivered' | 'read'

/** Дата в текущей локали или `null`, если момента ещё не было. */
function formatted(value: string | null, language: string): string | null {
  return value ? formatDate(value, language) : null
}

function line(moment: Moment, value: string, t: TFunction, language: string): string {
  return t('when.line', {
    label: t(`when.${moment}`),
    date: formatted(value, language) ?? '',
  })
}

/**
 * Одна строка «когда» для списка отправленных: по статусу видно, какой момент важен.
 * Моменты берутся из ответа сервера как есть — клиент не вычисляет статус из дат.
 */
export function sentDateLine(letter: LetterResponse, t: TFunction, language: string): string {
  switch (letter.status) {
    case 'sealed':
      return line('sealed', letter.sealed_at ?? letter.created_at, t, language)
    case 'in_transit':
      return line('deliver', letter.deliver_at ?? letter.created_at, t, language)
    case 'delivered':
      return line('delivered', letter.deliver_at ?? letter.created_at, t, language)
    case 'read':
      return line('read', letter.read_at ?? letter.created_at, t, language)
    case 'draft':
    case 'cancelled':
      return line('created', letter.created_at, t, language)
  }
}

/**
 * Строка «когда» для входящих. У конверта дат нет вообще — в ответе сервера их нет, — поэтому
 * `null`, а не пустая строка.
 */
export function inboxDateLine(
  letter: IncomingLetterView,
  t: TFunction,
  language: string,
): string | null {
  if (letter.view === 'incoming_preview') return null
  if (letter.status === 'read') {
    return line('read', letter.read_at ?? letter.delivered_at, t, language)
  }
  return line('delivered', letter.delivered_at, t, language)
}

/** Все моменты письма, которые пришли в ответе. В конверте их нет — и строк не будет. */
export function letterDates(
  letter: LetterResponse | IncomingLetter,
  t: TFunction,
  language: string,
): LetterDate[] {
  const rows: LetterDate[] = []
  const add = (moment: Moment, value: string | null) => {
    const date = formatted(value, language)
    if (date) rows.push({ label: t(`when.${moment}`), value: date })
  }

  if (letter.view === 'sender') {
    add('created', letter.created_at)
    add('sealed', letter.sealed_at)
    add('sent', letter.sent_at)
    add('deliver', letter.deliver_at)
    add('read', letter.read_at)
  } else {
    add('delivered', letter.delivered_at)
    add('read', letter.read_at)
  }

  return rows
}
