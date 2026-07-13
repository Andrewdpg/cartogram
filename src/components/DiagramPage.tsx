import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getDiagram, updateDiagram } from '../lib/diagramRepo'
import { resolveDiagramPath } from '../lib/resolveDiagramPath'
import { validateDiagramShape } from '../lib/validateDiagram'
import { DiagramNotFoundError } from '../lib/types'
import type { Diagram } from '../lib/types'
import { layoutDiagram } from '../lib/autoLayout'
import { DiagramCanvas } from './DiagramCanvas'
import { Breadcrumb } from './Breadcrumb'
import { SidePanel } from './SidePanel'

type LoadedDiagram = { diagram: Diagram; version: number }
type Resolution =
  | { status: 'loading' }
  | { status: 'error'; notFoundId: string }
  | { status: 'ready'; chain: LoadedDiagram[] }

export function DiagramPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const params = useParams()
  const navigate = useNavigate()
  const segments = useMemo(
    () => (params['*'] ?? '').split('/').filter(Boolean),
    [params['*']]
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [resolution, setResolution] = useState<Resolution>({ status: 'loading' })
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    setResolution({ status: 'loading' })
    resolveDiagramPath(projectId, segments, getDiagram)
      .then((r) => setResolution({ status: 'ready', chain: r.chain }))
      .catch((err) => {
        if (err instanceof DiagramNotFoundError) {
          setResolution({ status: 'error', notFoundId: err.diagramId })
        } else {
          throw err
        }
      })
  }, [projectId, segments])

  if (resolution.status === 'loading') return null

  if (resolution.status === 'error') {
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

  const { chain } = resolution
  const { diagram: current, version: currentVersion } = chain[chain.length - 1]
  const positionedNodes = layoutDiagram(current.nodes, current.edges)
  const labels = ['Home', ...chain.slice(1).map((d) => d.diagram.title)]
  const selectedNode = current.nodes.find((n) => n.id === selectedNodeId) ?? null

  function handleNodeClick(nodeId: string) {
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node?.childDiagram) return
    navigate(`/projects/${projectId}/${[...segments, nodeId].join('/')}`)
  }

  function handleNodeDetailRequest(nodeId: string) {
    setSelectedNodeId(nodeId)
    setPanelCollapsed(false)
  }

  function handleBreadcrumbNavigate(index: number) {
    setSelectedNodeId(null)
    navigate(`/projects/${projectId}/${segments.slice(0, index).join('/')}`)
  }

  async function handleApplyJson(raw: string): Promise<string | null> {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      return `Invalid JSON: ${(err as Error).message}`
    }
    let diagram: Diagram
    try {
      diagram = validateDiagramShape(parsed, current.id)
    } catch (err) {
      return (err as Error).message
    }

    const currentSlug = segments.length === 0 ? 'deployment' : current.id
    const result = await updateDiagram(
      projectId!,
      currentSlug,
      { nodes: diagram.nodes, edges: diagram.edges },
      currentVersion
    )
    if ('conflict' in result) {
      setConflictMessage(
        'This diagram changed since you loaded it (edited elsewhere or by an MCP-connected agent). Reload to see the latest version before retrying.'
      )
      return 'Save conflict: the diagram was updated elsewhere. Reload and reapply your changes.'
    }
    setConflictMessage(null)
    const refreshed = await resolveDiagramPath(projectId!, segments, getDiagram)
    setResolution({ status: 'ready', chain: refreshed.chain })
    return null
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        padding: 12,
        gap: 12,
        background: 'var(--bg)',
        boxSizing: 'border-box',
      }}
    >
      {conflictMessage && (
        <div role="alert" style={{ color: 'var(--error)', fontSize: 13 }}>
          {conflictMessage}
        </div>
      )}
      <Breadcrumb labels={labels} onNavigate={handleBreadcrumbNavigate} />
      <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DiagramCanvas
            nodes={positionedNodes}
            edges={current.edges}
            onNodeClick={handleNodeClick}
            onNodeDetailRequest={handleNodeDetailRequest}
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
