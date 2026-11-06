import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

import { LanguageSwitch } from './LanguageSwitch'
import styles from './AuthLayout.module.css'

/** Экраны до входа: логотип, переключатель языка и форма по центру. */
export function AuthLayout() {
  const { t } = useTranslation()

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.brand}>{t('app.name')}</span>
        <LanguageSwitch />
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
