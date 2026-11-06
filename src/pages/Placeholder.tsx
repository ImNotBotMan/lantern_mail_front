import { useTranslation } from 'react-i18next'

/** Заглушка экрана: показывает заголовок из словаря и ждёт своей фичи. */
export function Placeholder({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()
  return (
    <section>
      <h1>{t(titleKey)}</h1>
      <p>{t('state.empty')}</p>
    </section>
  )
}
