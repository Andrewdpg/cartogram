import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getDiagram, updateDiagram, listDiagrams } from '../lib/diagramRepo'
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
  const [searchParams] = useSearchParams()
  // Diagrams the MCP server (or anything else) creates via create_diagram
  // aren't necessarily linked into the deployment tree via a childDiagram
  // — without this, they'd be permanently unreachable from the UI short of
  // knowing their slug and constructing a URL by hand. ?diagram=<slug>
  // opens that diagram as its own root, independent of the deployment
  // tree; the diagram picker below sets it.
  const rootSlug = searchParams.get('diagram') ?? 'deployment'
  const segments = useMemo(
    () => (params['*'] ?? '').split('/').filter(Boolean),
    [params['*']]
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [resolution, setResolution] = useState<Resolution>({ status: 'loading' })
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const [availableDiagrams, setAvailableDiagrams] = useState<{ slug: string; title: string }[]>([])

  useEffect(() => {
    if (!projectId) return
    setResolution({ status: 'loading' })
    resolveDiagramPath(projectId, segments, getDiagram, rootSlug)
      .then((r) => setResolution({ status: 'ready', chain: r.chain }))
      .catch((err) => {
        if (err instanceof DiagramNotFoundError) {
          setResolution({ status: 'error', notFoundId: err.diagramId })
        } else {
          throw err
        }
      })
  }, [projectId, segments, rootSlug])

  useEffect(() => {
    if (!projectId) return
    listDiagrams(projectId).then(setAvailableDiagrams)
  }, [projectId])

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

  // ?diagram= must survive drill-down/breadcrumb navigation, or clicking
  // into a node would silently snap back to resolving from "deployment".
  const diagramQuery = rootSlug !== 'deployment' ? `?diagram=${encodeURIComponent(rootSlug)}` : ''

  function handleNodeClick(nodeId: string) {
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node?.childDiagram) return
    navigate(`/projects/${projectId}/${[...segments, nodeId].join('/')}${diagramQuery}`)
  }

  function handleNodeDetailRequest(nodeId: string) {
    setSelectedNodeId(nodeId)
    setPanelCollapsed(false)
  }

  function handleBreadcrumbNavigate(index: number) {
    setSelectedNodeId(null)
    navigate(`/projects/${projectId}/${segments.slice(0, index).join('/')}${diagramQuery}`)
  }

  function handleDiagramSelect(slug: string) {
    setSelectedNodeId(null)
    const query = slug !== 'deployment' ? `?diagram=${encodeURIComponent(slug)}` : ''
    navigate(`/projects/${projectId}/${query}`)
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

    const currentSlug = segments.length === 0 ? rootSlug : current.id
    let result: Awaited<ReturnType<typeof updateDiagram>>
    try {
      result = await updateDiagram(
        projectId!,
        currentSlug,
        { nodes: diagram.nodes, edges: diagram.edges },
        currentVersion
      )
    } catch (err) {
      // A real failure (network, RLS-unrelated Supabase error), not a
      // version conflict — updateDiagram only returns { conflict: true }
      // for PGRST116 and throws everything else. Must not fall through to
      // the conflict message below, which would misleadingly tell the user
      // "someone else edited this" for an unrelated failure.
      return `Failed to save: ${(err as Error).message}`
    }
    if ('conflict' in result) {
      setConflictMessage(
        'This diagram changed since you loaded it (edited elsewhere or by an MCP-connected agent). Reload to see the latest version before retrying.'
      )
      return 'Save conflict: the diagram was updated elsewhere. Reload and reapply your changes.'
    }
    setConflictMessage(null)
    const refreshed = await resolveDiagramPath(projectId!, segments, getDiagram, rootSlug)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Breadcrumb labels={labels} onNavigate={handleBreadcrumbNavigate} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {availableDiagrams.length > 1 && (
            <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Diagram:{' '}
              <select
                aria-label="Diagram"
                value={rootSlug}
                onChange={(e) => handleDiagramSelect(e.target.value)}
              >
                {availableDiagrams.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Link to={`/projects/${projectId}/share`} style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Share
          </Link>
        </div>
      </div>
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
