import { useEffect, useState } from 'react'
import type { DiagramNodeData, Notation } from '../lib/types'
import { DiagramDetailPanel } from './DiagramDetailPanel'
import { LegendTab } from './LegendTab'

export interface SidePanelProps {
  node: DiagramNodeData | null
  notation: Notation
  onCloseNode: () => void
  diagramJson: string
  onApplyJson: (raw: string) => string | null
  collapsed: boolean
  onToggleCollapsed: () => void
}

type Tab = 'details' | 'json' | 'legend'

const TAB_LABELS: Record<Tab, string> = { details: 'Details', json: 'Edit JSON', legend: 'Legend' }

export function SidePanel({
  node,
  notation,
  onCloseNode,
  diagramJson,
  onApplyJson,
  collapsed,
  onToggleCollapsed,
}: SidePanelProps) {
  const [tab, setTab] = useState<Tab>('legend')
  const [jsonText, setJsonText] = useState(diagramJson)
  const [jsonError, setJsonError] = useState<string | null>(null)

  // ponytail: re-seed the textarea whenever the underlying diagram changes
  // (navigation, or an applied edit) — session-only editor, no undo history.
  useEffect(() => {
    setJsonText(diagramJson)
    setJsonError(null)
  }, [diagramJson])

  useEffect(() => {
    if (node) setTab('details')
  }, [node])

  function handleApply() {
    setJsonError(onApplyJson(jsonText))
  }

  if (collapsed) {
    return (
      <button
        className="icon-btn"
        aria-label="Show side panel"
        onClick={onToggleCollapsed}
        style={{
          flexShrink: 0,
          width: 28,
          border: 'none',
          borderLeft: '1px solid var(--border)',
          borderRadius: 0,
          background: 'var(--surface)',
          fontSize: 14,
        }}
      >
        ◀
      </button>
    )
  }

  return (
    <aside
      style={{
        width: 360,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <button
          className="icon-btn"
          aria-label="Hide side panel"
          onClick={onToggleCollapsed}
          style={{
            flexShrink: 0,
            border: 'none',
            background: 'transparent',
            fontSize: 12,
            padding: '10px 8px',
          }}
        >
          ▶
        </button>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              background: 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              textTransform: 'uppercase',
              transition: 'color var(--transition), border-color var(--transition)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {tab === 'details' && <DiagramDetailPanel node={node} notation={notation} onClose={onCloseNode} />}
        {tab === 'json' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
              aria-label="Diagram JSON"
              style={{
                flex: 1,
                minHeight: 320,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                background: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: 8,
                resize: 'vertical',
              }}
            />
            {jsonError && <p style={{ color: 'var(--error)', fontSize: 12, margin: 0 }}>{jsonError}</p>}
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
              Session-only — edits apply immediately but are not written back to the diagram file.
            </p>
          </div>
        )}
        {tab === 'legend' && <LegendTab />}
      </div>
    </aside>
  )
}
