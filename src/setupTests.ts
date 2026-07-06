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
