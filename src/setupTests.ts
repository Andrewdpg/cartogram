import '@testing-library/jest-dom'

// ponytail: @xyflow/react measures nodes via ResizeObserver, which jsdom
// doesn't implement. A no-op stub is enough for render/interaction tests —
// we never assert on measured sizes.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).ResizeObserver = ResizeObserverStub

// ponytail: @xyflow/react's useUpdateNodeInternals reads `new
// window.DOMMatrixReadOnly(style.transform).m22` (the viewport's zoom
// factor) — a real browser API jsdom doesn't implement. Only `m22` is ever
// read by that call site; this stub parses a canonical `matrix(a,b,c,d,e,f)`
// string for it and falls back to an identity matrix (zoom 1) for anything
// it can't parse, which is the sane default for tests anyway.
class DOMMatrixReadOnlyStub {
  m11 = 1
  m12 = 0
  m21 = 0
  m22 = 1
  m41 = 0
  m42 = 0

  constructor(transform?: string) {
    const match = transform?.match(/matrix\(([^)]+)\)/)
    if (!match) return
    const [a, b, c, d, e, f] = match[1].split(',').map((n) => parseFloat(n.trim()))
    if ([a, b, c, d, e, f].some((n) => Number.isNaN(n))) return
    this.m11 = a
    this.m12 = b
    this.m21 = c
    this.m22 = d
    this.m41 = e
    this.m42 = f
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).DOMMatrixReadOnly = DOMMatrixReadOnlyStub
