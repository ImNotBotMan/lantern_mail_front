import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'danger'

interface LinkButtonProps {
  to: string
  variant?: Variant
  children: ReactNode
}

/**
 * Переход, который выглядит кнопкой. Остаётся ссылкой: её можно открыть в новой вкладке,
 * и скринридер называет её ссылкой, а не кнопкой.
 */
export function LinkButton({ to, variant = 'secondary', children }: LinkButtonProps) {
  return (
    <Link to={to} className={`${styles.button} ${styles.link} ${styles[variant]}`}>
      {children}
    </Link>
  )
}
