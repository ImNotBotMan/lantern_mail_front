import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

import styles from './formField.module.css'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

export function Field({ label, hint, error, id, ...rest }: FieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const describedBy = [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      />
      {hint ? (
        <span id={`${fieldId}-hint`} className={styles.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${fieldId}-error`} className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
