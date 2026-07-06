import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadDiagram } from '../lib/loadDiagram'
import { resolveDiagramPath } from '../lib/resolveDiagramPath'
import { DiagramNotFoundError } from '../lib/types'
import type { Diagram } from '../lib/types'
import { layoutDiagram } from '../lib/autoLayout'
import { DiagramCanvas } from './DiagramCanvas'
import { Breadcrumb } from './Breadcrumb'

type Resolution = { chain: Diagram[] } | { notFoundId: string }

export function DiagramPage() {
  const params = useParams()
  const navigate = useNavigate()
  const segments = useMemo(
    () => (params['*'] ?? '').split('/').filter(Boolean),
    [params['*']]
  )

  const resolution: Resolution = useMemo(() => {
    try {
      return resolveDiagramPath(segments, loadDiagram)
    } catch (err) {
      if (err instanceof DiagramNotFoundError) {
        return { notFoundId: err.diagramId }
      }
      throw err
    }
  }, [segments])

  if ('notFoundId' in resolution) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          gap: 8,
          background: '#14151a',
          color: '#e7e8ed',
          fontFamily: "'Outfit', system-ui, sans-serif",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Diagram not found</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#9096a8' }}>
          {resolution.notFoundId}
        </span>
      </div>
    )
  }

  const current = resolution.chain[resolution.chain.length - 1]
  const positionedNodes = layoutDiagram(current.nodes, current.edges)
  const labels = ['Home', ...resolution.chain.slice(1).map((d) => d.title)]

  function handleNodeClick(nodeId: string) {
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node?.childDiagram) return
    navigate(`/${[...segments, nodeId].join('/')}`)
  }

  function handleBreadcrumbNavigate(index: number) {
    navigate(`/${segments.slice(0, index).join('/')}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <Breadcrumb labels={labels} onNavigate={handleBreadcrumbNavigate} />
      <div style={{ flex: 1 }}>
        <DiagramCanvas nodes={positionedNodes} edges={current.edges} onNodeClick={handleNodeClick} />
      </div>
    </div>
  )
}
