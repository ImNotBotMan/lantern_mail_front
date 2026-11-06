import { useTranslation } from 'react-i18next'

import { SUPPORTED_LANGUAGES, persistLanguage } from '../../shared/i18n'
import type { Language } from '../../shared/i18n'
import styles from './LanguageSwitch.module.css'

/** Доступен и до входа, и в шапке приложения (docs/specs/module-front-i18n-ui.md). */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation()

  function change(language: Language) {
    void i18n.changeLanguage(language)
    persistLanguage(language)
  }

  return (
    <select
      className={styles.select}
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
