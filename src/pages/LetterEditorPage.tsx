import { useParams } from 'react-router-dom'

import { LetterEditor } from '../features/letters'

/** Один экран на два адреса: `/letters/new` — новое письмо, `/letters/:id/edit` — черновик. */
export function LetterEditorPage() {
  const { id } = useParams()

  return <LetterEditor letterId={id} />
}
