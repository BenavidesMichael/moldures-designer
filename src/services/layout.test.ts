import { describe, it, expect } from 'vitest'
import { computeFrameLayout, computeNestedRect, computeZoneRect } from './layout.js'
import type { Zone, Wall, Rect } from '../types/index.js'

function makeZone(overrides: Partial<Zone['layout']> = {}): Zone {
  return {
    id: 'z1', type: 'full',
    layout: {
      frameCount: 2,
      marginTop: 10, marginBottom: 10,
      marginLeft: 10, marginRight: 10,
      gapBetweenFrames: 5,
      customWidths: [0, 0],
      customHeights: [0, 0],
      ...overrides,
    },
    frames: [],
  }
}

describe('computeFrameLayout', () => {
  it('divides available width equally for 2 auto frames', () => {
    const zone = makeZone()
    const zoneRect: Rect = { x: 0, y: 0, width: 200, height: 100 }
    const rects = computeFrameLayout(zone, zoneRect)
    // availableWidth = 200 - 10 - 10 = 180, gap = 5, 2 frames → each = (180-5)/2 = 87.5
    expect(rects).toHaveLength(2)
    expect(rects[0]!.width).toBeCloseTo(87.5)
    expect(rects[1]!.width).toBeCloseTo(87.5)
  })

  it('positions frames sequentially with gap', () => {
    const zone = makeZone()
    const zoneRect: Rect = { x: 0, y: 0, width: 200, height: 100 }
    const rects = computeFrameLayout(zone, zoneRect)
    expect(rects[0]!.x).toBeCloseTo(10) // marginLeft
    expect(rects[1]!.x).toBeCloseTo(10 + 87.5 + 5) // marginLeft + w0 + gap
  })

  it('respects custom widths and uses auto for remaining', () => {
    const zone = makeZone({ frameCount: 3, customWidths: [60, 0, 0], customHeights: [0, 0, 0] })
    const zoneRect: Rect = { x: 0, y: 0, width: 200, height: 100 }
    const rects = computeFrameLayout(zone, zoneRect)
    // availableWidth=180, fixedWidths=60, gaps=2×5=10, autoWidth=(180-10-60)/2=55
    expect(rects[0]!.width).toBe(60)
    expect(rects[1]!.width).toBeCloseTo(55)
    expect(rects[2]!.width).toBeCloseTo(55)
  })

  it('uses full available height when customHeight is 0', () => {
    const zone = makeZone()
    const zoneRect: Rect = { x: 0, y: 0, width: 200, height: 100 }
    const rects = computeFrameLayout(zone, zoneRect)
    // availableHeight = 100 - 10 - 10 = 80
    expect(rects[0]!.height).toBe(80)
  })

  it('handles out-of-bounds customWidths index as 0', () => {
    const zone = makeZone({ frameCount: 3, customWidths: [0, 0], customHeights: [0, 0] })
    const zoneRect: Rect = { x: 0, y: 0, width: 200, height: 100 }
    const rects = computeFrameLayout(zone, zoneRect)
    expect(rects).toHaveLength(3)
    // no crash, all auto
    expect(rects[2]!.width).toBeGreaterThan(0)
  })
})

describe('computeNestedRect', () => {
  it('reduces rect by cumulative offset on all sides', () => {
    const parent: Rect = { x: 10, y: 10, width: 100, height: 80 }
    const nested = computeNestedRect(parent, 5)
    expect(nested).toEqual({ x: 15, y: 15, width: 90, height: 70 })
  })

  it('returns zero-width rect when offset exceeds half-width', () => {
    const parent: Rect = { x: 0, y: 0, width: 10, height: 20 }
    const nested = computeNestedRect(parent, 8)
    expect(nested.width).toBeLessThanOrEqual(0)
  })
})

describe('computeZoneRect', () => {
  const wall: Wall = {
    id: 'w1', name: 'Mur',
    dimensions: { width: 400, height: 250, plinthHeight: 10 },
    zoneMode: '2zones',
    zones: [],
    separator: { positionPercent: 60, visible: true, moldingId: 'm1' },
    obstacles: [],
    colors: { wall: '#fff', moldings: '', plinth: '#fff' },
    showAnnotations: false,
  }

  it('computes full zone rect in 1-zone mode', () => {
    const w1 = { ...wall, zoneMode: '1zone' as const, separator: undefined }
    const rect = computeZoneRect(w1, 'full')
    // usableHeight = 250 - 10 = 240
    expect(rect.height).toBe(240)
    expect(rect.y).toBe(0)
  })

  it('computes top zone at 60% separator', () => {
    const rect = computeZoneRect(wall, 'top')
    // usableHeight=240, separatorY = 240 * 0.60 = 144
    expect(rect.height).toBeCloseTo(144)
    expect(rect.y).toBe(0)
  })

  it('computes bottom zone below separator', () => {
    const rect = computeZoneRect(wall, 'bottom')
    // usableHeight=240, separatorY=144, bottomHeight=240-144=96
    expect(rect.height).toBeCloseTo(96)
    expect(rect.y).toBeCloseTo(144)
  })
})
