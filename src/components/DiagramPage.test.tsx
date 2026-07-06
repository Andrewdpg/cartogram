import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { DiagramPage } from './DiagramPage'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/*" element={<DiagramPage />} />
      </Routes>
    </MemoryRouter>
  )
}

// ponytail: same d3-drag/jsdom `event.view.document` gap as
// DiagramCanvas.test.tsx (see that file for the full explanation). Scoped
// to this file only; matched on the d3-drag stack frame so unrelated
// errors still surface. Upgrade path: remove once jsdom sets a
// browser-accurate `view` default for synthetic MouseEvents.
let onError: (event: ErrorEvent) => void
beforeEach(() => {
  onError = (event) => {
    if (
      event.error instanceof TypeError &&
      event.error.message === "Cannot read properties of null (reading 'document')" &&
      event.error.stack?.includes('d3-drag')
    ) {
      event.preventDefault()
    }
  }
  window.addEventListener('error', onError)
})
afterEach(() => {
  window.removeEventListener('error', onError)
})

describe('DiagramPage', () => {
  it('renders the root deployment diagram at "/"', () => {
    renderAt('/')
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('API Service')).toBeInTheDocument()
  })

  it('drills down into a child diagram by clicking a node', async () => {
    renderAt('/')
    await userEvent.click(screen.getByText('API Service'))
    expect(await screen.findByText('Auth Module')).toBeInTheDocument()
  })

  it('renders a not-found state for a bad path', () => {
    renderAt('/does-not-exist')
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})
