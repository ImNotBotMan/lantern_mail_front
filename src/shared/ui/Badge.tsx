import type { ReactNode } from 'react'

import styles from './Badge.module.css'

type Tone = 'neutral' | 'accent' | 'muted'

interface BadgeProps {
  tone?: Tone
  children: ReactNode
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  const toneClass = tone === 'neutral' ? '' : styles[tone]
  return <span className={`${styles.badge} ${toneClass}`}>{children}</span>
}
