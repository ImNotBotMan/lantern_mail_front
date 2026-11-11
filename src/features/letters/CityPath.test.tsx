import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import i18n from '../../shared/i18n'
import { moscow, petersburg } from '../../test/msw/handlers'
import { cityName } from '../city'
import { CityPath } from './CityPath'

const pathLine = (from: string, to: string) => i18n.t('letter.path', { ns: 'letters', from, to })

describe('путь письма', () => {
  it('называет города отправки и доставки', () => {
    render(<CityPath senderCity={moscow} recipientCity={petersburg} />)

    const line = pathLine(cityName(moscow, i18n.language), cityName(petersburg, i18n.language))
    expect(screen.getByText(line)).toBeInTheDocument()
  })

  it('молчит, если снимка городов у письма нет', () => {
    const { container } = render(<CityPath senderCity={null} recipientCity={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
