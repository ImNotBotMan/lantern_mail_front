import { useTranslation } from 'react-i18next'

import type { LetterStatus } from '../../api'
import { Badge } from '../../shared/ui'

type Tone = 'neutral' | 'accent' | 'muted'

/**
 * Оттенок — дополнение к слову, а не носитель смысла: рядом со значком статус всегда
 * написан текстом (docs/specs/module-front-i18n-ui.md).
 */
const TONES = {
  draft: 'muted',
  sealed: 'neutral',
  in_transit: 'accent',
  delivered: 'accent',
  read: 'neutral',
  cancelled: 'muted',
} as const satisfies Record<LetterStatus, Tone>

export function StatusBadge({ status }: { status: LetterStatus }) {
  const { t } = useTranslation('letters')

  return <Badge tone={TONES[status]}>{t(`status.${status}`)}</Badge>
}
