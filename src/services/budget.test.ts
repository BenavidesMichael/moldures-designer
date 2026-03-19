import { describe, it, expect } from 'vitest'
import { computeBudget } from './budget.js'
import type { Project, Wall } from '../types/index.js'

function makeProject(): Project {
  return {
    id: 'p1', version: 1, name: 'Test', createdAt: '2026-01-01',
    activeWallId: 'w1',
    moldings: [{
      id: 'm1', name: 'Pin', reference: 'X', width: 16, thickness: 29,
      barLength: 270, pricePerBar: 4.50, color: '#fff',
    }],
    rosettes: [],
    walls: [],
  }
}

function makeWall(width = 200, height = 100, plinth = 10): Wall {
  return {
    id: 'w1', name: 'Mur',
    dimensions: { width, height, plinthHeight: plinth },
    zoneMode: '1zone',
    zones: [{
      id: 'z1', type: 'full',
      layout: {
        frameCount: 1,
        marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5,
        gapBetweenFrames: 0,
        customWidths: [0], customHeights: [0],
      },
      frames: [{ id: 'f1', moldingId: 'm1', cornerStyle: 'miter', nestedLevels: [] }],
    }],
    obstacles: [], separator: undefined,
    colors: { wall: '#fff', moldings: '', plinth: '#fff' },
    showAnnotations: false,
  }
}

describe('computeBudget', () => {
  it('calculates linear meters for a single frame', () => {
    const project = makeProject()
    const wall = makeWall(200, 100, 10)
    // zoneRect: {x:0,y:0,w:200,h:90}, frameRect: {x:5,y:5,w:190,h:80}
    // perimeter = 2*(190+80) = 540 cm = 5.4 m
    const budget = computeBudget(project, wall)
    expect(budget.lines).toHaveLength(1)
    expect(budget.lines[0]!.linearMeters).toBeCloseTo(5.4)
  })

  it('applies 15% waste factor for frames', () => {
    const project = makeProject()
    const wall = makeWall(200, 100, 10)
    const budget = computeBudget(project, wall)
    // 5.4m * 1.15 = 6.21m, barLength=270cm=2.7m → ceil(6.21/2.7) = ceil(2.3) = 3 bars
    expect(budget.lines[0]!.wasteFactor).toBe(1.15)
    expect(budget.lines[0]!.barsNeeded).toBe(3)
  })

  it('calculates cost correctly', () => {
    const project = makeProject()
    const wall = makeWall(200, 100, 10)
    const budget = computeBudget(project, wall)
    expect(budget.lines[0]!.totalCost).toBeCloseTo(3 * 4.50)
  })

  it('adds separator without waste factor', () => {
    const project = makeProject()
    const wall: Wall = {
      ...makeWall(270, 100, 10),
      separator: { positionPercent: 50, visible: true, moldingId: 'm1' },
      zoneMode: '2zones',
      zones: [
        { id: 'z1', type: 'top', layout: { frameCount: 0, marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5, gapBetweenFrames: 0, customWidths: [], customHeights: [] }, frames: [] },
        { id: 'z2', type: 'bottom', layout: { frameCount: 0, marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5, gapBetweenFrames: 0, customWidths: [], customHeights: [] }, frames: [] },
      ],
    }
    const budget = computeBudget(project, wall)
    const railLine = budget.lines.find(l => l.wasteFactor === 1.0)
    expect(railLine).toBeDefined()
    // wall width = 270cm = 2.7m, barLength = 270cm = 2.7m → 1 bar
    expect(railLine!.barsNeeded).toBe(1)
  })

  it('counts 4 rosettes per frame with rosette corner style', () => {
    const project: Project = {
      ...makeProject(),
      rosettes: [{ id: 'r1', name: 'Rosette', reference: 'R1', size: 5, pricePerPiece: 2 }],
    }
    const wall: Wall = {
      ...makeWall(),
      zones: [{
        id: 'z1', type: 'full',
        layout: { frameCount: 2, marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5, gapBetweenFrames: 5, customWidths: [0, 0], customHeights: [0, 0] },
        frames: [
          { id: 'f1', moldingId: 'm1', cornerStyle: 'rosette', rosetteId: 'r1', nestedLevels: [] },
          { id: 'f2', moldingId: 'm1', cornerStyle: 'rosette', rosetteId: 'r1', nestedLevels: [] },
        ],
      }],
    }
    const budget = computeBudget(project, wall)
    expect(budget.rosetteLines).toHaveLength(1)
    expect(budget.rosetteLines[0]!.count).toBe(8) // 4 × 2 frames
    expect(budget.rosetteLines[0]!.totalCost).toBeCloseTo(16) // 8 × 2€
  })

  it('returns zero cost for empty wall', () => {
    const project = makeProject()
    const wall: Wall = {
      ...makeWall(),
      zones: [{ id: 'z1', type: 'full', layout: { frameCount: 0, marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5, gapBetweenFrames: 0, customWidths: [], customHeights: [] }, frames: [] }],
    }
    const budget = computeBudget(project, wall)
    expect(budget.totalCost).toBe(0)
    expect(budget.lines).toHaveLength(0)
  })

  it('handles nested frame levels with distinct molding widths', () => {
    const project: Project = {
      ...makeProject(),
      moldings: [
        { id: 'm1', name: 'Outer', reference: 'A', width: 30, thickness: 29, barLength: 270, pricePerBar: 4.50, color: '#fff' },
        { id: 'm2', name: 'Inner', reference: 'B', width: 10, thickness: 15, barLength: 270, pricePerBar: 3.00, color: '#fff' },
      ],
    }
    const wall: Wall = {
      ...makeWall(200, 100, 10),
      zones: [{
        id: 'z1', type: 'full',
        layout: { frameCount: 1, marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5, gapBetweenFrames: 0, customWidths: [0], customHeights: [0] },
        frames: [{
          id: 'f1', moldingId: 'm1', cornerStyle: 'miter',
          nestedLevels: [
            { moldingId: 'm2', cornerStyle: 'miter', offset: 2 }, // 2cm offset + m1.width(30mm=3cm) = 5cm inset from outer
          ],
        }],
      }],
    }
    const budget = computeBudget(project, wall)
    // Outer frame: zoneRect {w:200,h:90}, frameRect {x:5,y:5,w:190,h:80} → perimeter = 2*(190+80)=540cm=5.4m
    // Inner frame: inset by (offset=2 + outerWidth=3cm)=5cm → {x:10,y:10,w:180,h:70} → perimeter = 2*(180+70)=500cm=5.0m
    expect(budget.lines).toHaveLength(2)
    const outerLine = budget.lines.find(l => l.moldingId === 'm1')!
    const innerLine = budget.lines.find(l => l.moldingId === 'm2')!
    expect(outerLine.linearMeters).toBeCloseTo(5.4)
    expect(innerLine.linearMeters).toBeCloseTo(5.0)
  })
})
