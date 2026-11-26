import { useTranslation } from 'react-i18next'

import { errorMessage } from '../shared/i18n/apiError'
import { EmptyState, ErrorState, Spinner } from '../shared/ui'
import { StampCard } from '../features/letters/StampCard'
import { useStamps } from '../features/letters/useStamps'

/**
 * Коллекция марок: весь каталог с личными остатками (`GET /stamps`). Карточки — те же,
 * что в диалоге запечатывания, только без выбора: страница показывает, чем клеить и
 * что кончилось. Данные — тот же ключ `['stamps']`, поэтому страница обновляется сама
 * после запечатывания, распечатки и доставки письма с маркой.
 */
export function CollectionPage() {
  const { t, i18n } = useTranslation('letters')
  const stamps = useStamps()

  if (stamps.isPending) return <Spinner />

  if (stamps.isError) {
    return (
      <section>
        <h1>{t('collection.title')}</h1>
        <ErrorState message={errorMessage(stamps.error)} onRetry={() => void stamps.refetch()} />
      </section>
    )
  }

  return (
    <section>
      <h1>{t('collection.title')}</h1>
      {stamps.data.length === 0 ? (
        <EmptyState message={t('collection.empty')} />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stamps.data.map((stamp) => (
            <StampCard key={stamp.id} stamp={stamp} language={i18n.language} />
          ))}
        </div>
      )}
    </section>
  )
}
