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
if (typeof globalThis.ResizeObserver === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).ResizeObserver = ResizeObserverPolyfill
}

// jsdom does not implement Element.scrollIntoView — cmdk calls it on the
// active CommandItem to keep it visible. No-op shim is sufficient for tests.
if (
  typeof Element !== 'undefined' &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeof (Element.prototype as any).scrollIntoView !== 'function'
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Element.prototype as any).scrollIntoView = function () {}
}
