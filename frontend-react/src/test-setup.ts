import '@testing-library/jest-dom'

// jsdom does not implement window.matchMedia — mock it for all tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// jsdom does not implement ResizeObserver — required by cmdk (Command primitive
// inside the SearchBar recent-searches Popover) and Radix UI primitives.
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const globalRef = globalThis as unknown as { ResizeObserver?: unknown }
if (typeof globalRef.ResizeObserver === 'undefined') {
  globalRef.ResizeObserver = ResizeObserverPolyfill
}

// jsdom does not implement Element.scrollIntoView — cmdk calls it on the
// active CommandItem to keep it visible. No-op shim is sufficient for tests.
if (typeof Element !== 'undefined') {
  const proto = Element.prototype as unknown as { scrollIntoView?: () => void }
  if (typeof proto.scrollIntoView !== 'function') {
    proto.scrollIntoView = () => {}
  }
}
