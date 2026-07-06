import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DiagramNode } from './DiagramNode'

// ponytail: DiagramNode only ever reads `data`, so it's typed to take just
// that — not @xyflow/react's full NodeProps, whose shape has changed across
// major versions. Keeps this test decoupled from that library's internals.
function renderNode(kind: string) {
  return render(
    <ReactFlowProvider>
      <DiagramNode data={{ label: 'My Node', kind }} />
    </ReactFlowProvider>
  )
}

describe('DiagramNode', () => {
  it('renders the label', () => {
    renderNode('service')
    expect(screen.getByText('My Node')).toBeInTheDocument()
  })

  it('applies the known style for kind "service"', () => {
    renderNode('service')
    const el = screen.getByText('My Node').closest('div')
    expect(el).toHaveStyle({ borderColor: '#4f8cff' })
  })

  it('falls back to the default style for an unknown kind', () => {
    renderNode('something-new')
    const el = screen.getByText('My Node').closest('div')
    expect(el).toHaveStyle({ borderColor: '#9b9b9b' })
  })
})
