import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <section>
      <h1>{t('not_found', { ns: 'errors' })}</h1>
      <Link to="/inbox">{t('nav.inbox')}</Link>
    </section>
  )
}
