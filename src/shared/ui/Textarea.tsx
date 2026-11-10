import { useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'

import styles from './formField.module.css'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

/** Многострочное поле: того же вида, что `Field`, но для длинного текста. */
export function Textarea({ label, id, className, ...rest }: TextareaProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const classes = [styles.control, styles.textarea, className].filter(Boolean).join(' ')

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <textarea id={fieldId} className={classes} {...rest} />
    </div>
  )
}
