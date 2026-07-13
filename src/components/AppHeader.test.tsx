import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppHeader } from './AppHeader'

describe('AppHeader', () => {
  it('renders the cartogram wordmark', () => {
    render(<AppHeader />)
    expect(screen.getByText('cartogram')).toBeInTheDocument()
  })

  it('renders actions passed to it', () => {
    render(<AppHeader actions={<button>Nuevo proyecto</button>} />)
    expect(screen.getByText('Nuevo proyecto')).toBeInTheDocument()
  })
})
