import { useTranslation } from 'react-i18next'

import { InboxList } from '../features/letters'

export function InboxPage() {
  const { t } = useTranslation('letters')

  return (
    <section>
      <h1>{t('inbox.title')}</h1>
      <InboxList />
    </section>
  )
}
