import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'

import { SUPPORTED_LANGUAGES, persistLanguage } from '../../shared/i18n'
import type { Language } from '../../shared/i18n'
import styles from './AppLayout.module.css'

function LanguageSwitch() {
  const { t, i18n } = useTranslation()

  function change(language: Language) {
    void i18n.changeLanguage(language)
    persistLanguage(language)
  }

  return (
    <select
      aria-label={t('language.label')}
      value={i18n.language}
      onChange={(event) => change(event.target.value as Language)}
    >
      {SUPPORTED_LANGUAGES.map((language) => (
        <option key={language} value={language}>
          {t(`language.${language}`)}
        </option>
      ))}
    </select>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink

export function AppLayout() {
  const { t } = useTranslation()

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <NavLink to="/inbox" className={styles.brand}>
          {t('app.name')}
        </NavLink>
        <nav className={styles.nav}>
          <NavLink to="/inbox" className={navClass}>
            {t('nav.inbox')}
          </NavLink>
          <NavLink to="/sent" className={navClass}>
            {t('nav.sent')}
          </NavLink>
          <NavLink to="/friends" className={navClass}>
            {t('nav.friends')}
          </NavLink>
        </nav>
        <span className={styles.spacer} />
        <LanguageSwitch />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
