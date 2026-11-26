import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import styles from './Dialog.module.css'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface DialogProps {
  title: string
  onClose: () => void
  /** Пока идёт запрос, диалог не закрывается: ни Esc, ни фоном, ни крестиком. */
  busy?: boolean
  children: ReactNode
  footer?: ReactNode
  /**
   * Без шапки и крестика: заголовок остаётся только для скринридера. Закрытие — Esc
   * или клик по затемнению (крупный план марки — контенту внутри не нужен интерфейс).
   */
  plain?: boolean
}

/**
 * Модальный диалог набора: оверлей, заголовок, крестик и фокус-трап. Нативного `<dialog>`
 * нет намеренно — jsdom не умеет `showModal`, и ловушку фокуса нельзя было бы проверить
 * тестом. Фокус входит в элемент с `data-autofocus` (или в сам диалог), `Tab` ходит по
 * кругу, `Esc` закрывает, после закрытия фокус возвращается туда, откуда диалог открыли.
 */
export function Dialog({
  title,
  onClose,
  busy = false,
  children,
  footer,
  plain = false,
}: DialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const target = dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog
    target?.focus()

    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previousOverflow
      const restore = restoreTo.current
      if (restore?.isConnected) restore.focus()
    }
  }, [])

  function close() {
    if (!busy) onClose()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
      return
    }
    if (event.key !== 'Tab') return

    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    if (items.length === 0) {
      event.preventDefault()
      return
    }

    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    const active = document.activeElement
    const outside = !dialogRef.current?.contains(active)
    if (!event.shiftKey && (active === last || outside)) {
      event.preventDefault()
      first.focus()
    } else if (event.shiftKey && (active === first || outside)) {
      event.preventDefault()
      last.focus()
    }
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {plain ? (
          <h2 id={titleId} className={styles.visuallyHidden}>
            {title}
          </h2>
        ) : (
          <div className={styles.head}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button
              type="button"
              className={styles.close}
              aria-label={t('actions.close')}
              disabled={busy}
              onClick={close}
            >
              ×
            </button>
          </div>
        )}
        <div className={styles.content}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  )
}
