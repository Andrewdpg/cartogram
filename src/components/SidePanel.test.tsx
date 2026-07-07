import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SidePanel } from './SidePanel'

const baseProps = {
  node: null,
  notation: 'c4' as const,
  onCloseNode: () => {},
  diagramJson: '{}',
  onApplyJson: () => null,
}

describe('SidePanel', () => {
  it('renders the full panel with tabs when not collapsed', () => {
    render(<SidePanel {...baseProps} collapsed={false} onToggleCollapsed={() => {}} />)
    expect(screen.getByText('Legend')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()
  })

  it('renders only a slim toggle strip when collapsed, no tab content', () => {
    render(<SidePanel {...baseProps} collapsed={true} onToggleCollapsed={() => {}} />)
    expect(screen.queryByText('Legend')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Show side panel')).toBeInTheDocument()
  })

  it('calls onToggleCollapsed when the hide button is clicked', async () => {
    const onToggleCollapsed = vi.fn()
    render(<SidePanel {...baseProps} collapsed={false} onToggleCollapsed={onToggleCollapsed} />)
    await userEvent.click(screen.getByLabelText('Hide side panel'))
    expect(onToggleCollapsed).toHaveBeenCalled()
  })

  it('calls onToggleCollapsed when the show button is clicked', async () => {
    const onToggleCollapsed = vi.fn()
    render(<SidePanel {...baseProps} collapsed={true} onToggleCollapsed={onToggleCollapsed} />)
    await userEvent.click(screen.getByLabelText('Show side panel'))
    expect(onToggleCollapsed).toHaveBeenCalled()
  })
})
