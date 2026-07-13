import { useEffect, useState } from 'react'
import type { DiagramNodeData, Notation } from '../lib/types'
import { DiagramDetailPanel } from './DiagramDetailPanel'
import { LegendTab } from './LegendTab'
import { ShareTab } from './ShareTab'

export type Tab = 'details' | 'json' | 'legend' | 'share'

export interface SidePanelProps {
  node: DiagramNodeData | null
  notation: Notation
  onCloseNode: () => void
  diagramJson: string
  onApplyJson: (raw: string) => Promise<string | null>
  collapsed: boolean
  onToggleCollapsed: () => void
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  projectId: string
}

const TAB_LABELS: Record<Tab, string> = {
  details: 'Details',
  json: 'Edit JSON',
  legend: 'Legend',
  share: 'Share',
}

export function SidePanel({
  node,
  notation,
  onCloseNode,
  diagramJson,
  onApplyJson,
  collapsed,
  onToggleCollapsed,
  activeTab,
  onTabChange,
  projectId,
}: SidePanelProps) {
  const [jsonText, setJsonText] = useState(diagramJson)
  const [jsonError, setJsonError] = useState<string | null>(null)

  // ponytail: re-seed the textarea whenever the underlying diagram changes
  // (navigation, or an applied edit) — session-only editor, no undo history.
  useEffect(() => {
    setJsonText(diagramJson)
    setJsonError(null)
  }, [diagramJson])

  async function handleApply() {
    setJsonError(await onApplyJson(jsonText))
  }

  return (
    <aside
      className="side-panel"
      style={{ width: collapsed ? 52 : 360, flexShrink: 0 }}
    >
      <div className="side-panel-header">
        <button
          className="icon-btn side-panel-toggle"
          aria-label={collapsed ? 'Show side panel' : 'Hide side panel'}
          onClick={onToggleCollapsed}
        >
          <span
            style={{
              display: 'inline-block',
              transition: 'transform var(--transition-slow)',
              transform: collapsed ? 'rotate(180deg)' : 'none',
            }}
          >
            ▶
          </span>
        </button>
        {!collapsed && (
          <div className="side-panel-tabs">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button
                key={t}
                className={`side-panel-tab${activeTab === t ? ' active' : ''}`}
                onClick={() => onTabChange(t)}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="side-panel-body">
          {activeTab === 'details' && (
            <DiagramDetailPanel node={node} notation={notation} onClose={onCloseNode} />
          )}
          {activeTab === 'json' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
              <textarea
                className="json-editor"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                spellCheck={false}
                aria-label="Diagram JSON"
              />
              {jsonError && (
                <p role="alert" className="alert">
                  {jsonError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleApply}>
                  Apply
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setJsonText(diagramJson)
                    setJsonError(null)
                  }}
                >
                  Reset
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                Saved to your account — conflicts are detected if edited elsewhere at the same time.
              </p>
            </div>
          )}
          {activeTab === 'legend' && <LegendTab />}
          {activeTab === 'share' && <ShareTab projectId={projectId} />}
        </div>
      )}
    </aside>
  )
}
