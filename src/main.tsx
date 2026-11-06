import './shared/ui/global.css'

import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import './shared/i18n'

const container = document.getElementById('root')
if (!container) {
  throw new Error('root element is missing in index.html')
}

createRoot(container).render(<App />)
