// src/test-setup.ts — polyfill utilisé uniquement en test (jsdom ne fournit pas crypto complet)
if (typeof crypto === 'undefined' || !crypto.randomUUID) {
  let counter = 0
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `test-uuid-${++counter}` },
  })
}
