import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'

import { chatsPaths, useChatEvents } from '../../features/chats'
import { lettersPaths } from '../../features/letters/paths'
import { LinkButton } from '../../shared/ui'
import { LanguageSwitch } from './LanguageSwitch'
import styles from './AppLayout.module.css'

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink

/**
 * Layout продукта живёт ровно тогда, когда сессия открыта и город выбран (его держат guard'ы),
 * поэтому realtime-шина подключается здесь один раз и закрывается вместе с выходом.
 */
export function AppLayout() {
  const { t } = useTranslation()
  useChatEvents()

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
          <NavLink to={chatsPaths.list} className={navClass}>
            {t('nav.chats')}
          </NavLink>
          <NavLink to="/friends" className={navClass}>
            {t('nav.friends')}
          </NavLink>
          <NavLink to="/account" className={navClass}>
            {t('nav.account')}
          </NavLink>
        </nav>
        <LinkButton to={lettersPaths.newLetter} variant="primary">
          {t('letters:sent.new')}
        </LinkButton>
        <span className={styles.spacer} />
        <LanguageSwitch />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
