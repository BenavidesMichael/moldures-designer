import { describe, it, expect } from 'vitest'
import { validateAndMigrate, toDateString } from './storage.js'

describe('validateAndMigrate', () => {
  it('rejects null', () => {
    expect(() => validateAndMigrate(null)).toThrow('Invalid project file')
  })

  it('rejects non-object', () => {
    expect(() => validateAndMigrate('string')).toThrow('Invalid project file')
  })

  it('rejects project with missing required fields', () => {
    expect(() => validateAndMigrate({ id: 'x', name: 'Test' })).toThrow('Invalid project file')
  })

  it('accepts valid v1 project and returns version 1', () => {
    const raw = {
      id: 'abc', version: 1, name: 'Test', createdAt: '2026-01-01',
      activeWallId: 'w1', moldings: [], rosettes: [],
      walls: [{
        id: 'w1', name: 'Mur', dimensions: { width: 300, height: 250, plinthHeight: 10 },
        zoneMode: '1zone', zones: [], obstacles: [],
        colors: { wall: '#fff', moldings: '', plinth: '#fff' },
        showAnnotations: true,
      }],
    }
    const result = validateAndMigrate(raw)
    expect(result.version).toBe(1)
    expect(result.name).toBe('Test')
  })

  it('fills missing version with 1', () => {
    const raw = {
      id: 'abc', name: 'Test', createdAt: '2026-01-01',
      activeWallId: 'w1', moldings: [], rosettes: [],
      walls: [],
    }
    const result = validateAndMigrate(raw)
    expect(result.version).toBe(1)
  })
})

describe('toDateString', () => {
  it('formats date as YYYY-MM-DD', () => {
    const d = new Date('2026-03-18T12:00:00Z')
    expect(toDateString(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
