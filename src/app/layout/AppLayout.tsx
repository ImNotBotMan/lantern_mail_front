import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'

import { LanguageSwitch } from './LanguageSwitch'
import styles from './AppLayout.module.css'

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
          <NavLink to="/account" className={navClass}>
            {t('nav.account')}
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
