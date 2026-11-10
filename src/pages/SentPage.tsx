import { useTranslation } from 'react-i18next'

import { SentList } from '../features/letters'

export function SentPage() {
  const { t } = useTranslation('letters')

  return (
    <section>
      <h1>{t('sent.title')}</h1>
      <SentList />
    </section>
  )
}
