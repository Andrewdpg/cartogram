import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiagramDetailPanel } from './DiagramDetailPanel'
import type { DiagramNodeData } from '../lib/types'

describe('DiagramDetailPanel', () => {
  it('renders a placeholder when node is null', () => {
    render(<DiagramDetailPanel node={null} notation="c4" onClose={() => {}} />)
    expect(screen.getByText(/click a node/i)).toBeInTheDocument()
  })

  it('renders responsibility, tech stack names, dataOwned, and gotchas when present', () => {
    const node: DiagramNodeData = {
      id: 'n1',
      label: 'Fraud Service',
      kind: 'service',
      responsibility: 'Detects fraud',
      techStack: ['go'],
      dataOwned: 'fraud_reports',
      gotchas: ['Martingale scanner is disabled'],
    }
    render(<DiagramDetailPanel node={node} notation="c4" onClose={() => {}} />)
    expect(screen.getByText('Fraud Service')).toBeInTheDocument()
    expect(screen.getByText('Detects fraud')).toBeInTheDocument()
    expect(screen.getByText('Go')).toBeInTheDocument()
    expect(screen.getByText('fraud_reports')).toBeInTheDocument()
    expect(screen.getByText('Martingale scanner is disabled')).toBeInTheDocument()
  })

  it('hides sections whose fields are absent', () => {
    const node: DiagramNodeData = { id: 'n1', label: 'Minimal', kind: 'service' }
    render(<DiagramDetailPanel node={node} notation="c4" onClose={() => {}} />)
    expect(screen.queryByText('Tech stack')).not.toBeInTheDocument()
    expect(screen.queryByText('Data owned')).not.toBeInTheDocument()
    expect(screen.queryByText('Gotchas')).not.toBeInTheDocument()
    expect(screen.queryByText('Source')).not.toBeInTheDocument()
  })

  it('shows attributes/operations for a class node in a uml-structural diagram', () => {
    const node: DiagramNodeData = {
      id: 'n1',
      label: 'User',
      kind: 'class',
      attributes: ['name: string'],
      operations: ['save(): void'],
    }
    render(<DiagramDetailPanel node={node} notation="uml-structural" onClose={() => {}} />)
    expect(screen.getByText('name: string')).toBeInTheDocument()
    expect(screen.getByText('save(): void')).toBeInTheDocument()
  })

  it('hides attributes/operations for a class node when the diagram notation is not uml-structural', () => {
    const node: DiagramNodeData = {
      id: 'n1',
      label: 'User',
      kind: 'class',
      attributes: ['name: string'],
    }
    render(<DiagramDetailPanel node={node} notation="c4" onClose={() => {}} />)
    expect(screen.queryByText('name: string')).not.toBeInTheDocument()
  })

  it('renders sourceRefs as a monospace list when present', () => {
    const node: DiagramNodeData = {
      id: 'n1',
      label: 'Fraud Service',
      kind: 'service',
      sourceRefs: ['internal/service/fraud/fraudService.go:112-173'],
    }
    render(<DiagramDetailPanel node={node} notation="c4" onClose={() => {}} />)
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('internal/service/fraud/fraudService.go:112-173')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    const node: DiagramNodeData = { id: 'n1', label: 'Minimal', kind: 'service' }
    render(<DiagramDetailPanel node={node} notation="c4" onClose={onClose} />)
    await userEvent.click(screen.getByLabelText('Close details'))
    expect(onClose).toHaveBeenCalled()
  })
})
