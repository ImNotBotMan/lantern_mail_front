import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Dialog } from './Dialog'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      {open ? (
        <Dialog
          title="Dialog title"
          onClose={() => setOpen(false)}
          footer={<button type="button">footer action</button>}
        >
          <input aria-label="first" data-autofocus />
          <button type="button">last content action</button>
        </Dialog>
      ) : null}
    </>
  )
}

async function openDialog() {
  const trigger = screen.getByRole('button', { name: 'open' })
  await userEvent.click(trigger)
  return { trigger, dialog: screen.getByRole('dialog', { name: 'Dialog title' }) }
}

describe('диалог', () => {
  it('вводит фокус внутрь, закрывается по Esc и возвращает фокус', async () => {
    render(<Harness />)
    const { trigger, dialog } = await openDialog()

    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    expect(screen.getByLabelText('first')).toHaveFocus()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('держит Tab и Shift+Tab внутри диалога', async () => {
    render(<Harness />)
    await openDialog()

    const close = screen.getByRole('button', { name: 'Close' })
    const last = screen.getByRole('button', { name: 'footer action' })

    // Футер — последний в разметке: с него Tab уходит на первый элемент, а не из диалога.
    last.focus()
    await userEvent.tab()
    expect(close).toHaveFocus()

    await userEvent.tab({ shift: true })
    expect(last).toHaveFocus()
  })
})
