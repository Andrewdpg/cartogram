import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadDiagram } from '../lib/loadDiagram'
import { resolveDiagramPath } from '../lib/resolveDiagramPath'
import { validateDiagramShape } from '../lib/validateDiagram'
import { DiagramNotFoundError } from '../lib/types'
import type { Diagram } from '../lib/types'
import { layoutDiagram } from '../lib/autoLayout'
import { DiagramCanvas } from './DiagramCanvas'
import { Breadcrumb } from './Breadcrumb'
import { SidePanel } from './SidePanel'

type Resolution = { chain: Diagram[] } | { notFoundId: string }

export function DiagramPage() {
  const params = useParams()
  const navigate = useNavigate()
  const segments = useMemo(
    () => (params['*'] ?? '').split('/').filter(Boolean),
    [params['*']]
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  // ponytail: session-only edits from the JSON tab, keyed by diagram id —
  // lost on refresh, never written back to diagrams/*.json.
  const [overrides, setOverrides] = useState<Map<string, Diagram>>(new Map())

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
          background: 'var(--bg)',
          color: 'var(--text)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Diagram not found</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
          {resolution.notFoundId}
        </span>
      </div>
    )
  }

  const originalCurrent = resolution.chain[resolution.chain.length - 1]
  const current = overrides.get(originalCurrent.id) ?? originalCurrent
  const positionedNodes = layoutDiagram(current.nodes, current.edges)
  const labels = ['Home', ...resolution.chain.slice(1).map((d) => d.title)]
  const selectedNode = current.nodes.find((n) => n.id === selectedNodeId) ?? null

  function handleNodeClick(nodeId: string) {
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node?.childDiagram) return
    navigate(`/${[...segments, nodeId].join('/')}`)
  }

  function handleBreadcrumbNavigate(index: number) {
    setSelectedNodeId(null)
    navigate(`/${segments.slice(0, index).join('/')}`)
  }

  function handleApplyJson(raw: string): string | null {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      return `Invalid JSON: ${(err as Error).message}`
    }
    try {
      const diagram = validateDiagramShape(parsed, originalCurrent.id)
      setOverrides((prev) => new Map(prev).set(originalCurrent.id, diagram))
      return null
    } catch (err) {
      return (err as Error).message
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <Breadcrumb labels={labels} onNavigate={handleBreadcrumbNavigate} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1 }}>
          <DiagramCanvas
            nodes={positionedNodes}
            edges={current.edges}
            onNodeClick={handleNodeClick}
            onNodeDetailRequest={setSelectedNodeId}
          />
        </div>
        <SidePanel
          node={selectedNode}
          notation={current.notation ?? 'c4'}
          onCloseNode={() => setSelectedNodeId(null)}
          diagramJson={JSON.stringify(current, null, 2)}
          onApplyJson={handleApplyJson}
          collapsed={panelCollapsed}
          onToggleCollapsed={() => setPanelCollapsed((c) => !c)}
        />
      </div>
    </div>
  )
}
