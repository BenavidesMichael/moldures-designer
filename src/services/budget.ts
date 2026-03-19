import type { Project, Wall, Molding, Rosette, BudgetResult, BudgetLine, RosetteBudgetLine, Rect, Frame } from '../types/index.js'
import { computeFrameLayout, computeZoneRect, computeNestedRect } from './layout.js'

const FRAME_WASTE_FACTOR = 1.15
const CORNERS_PER_FRAME = 4
const MM_TO_CM = 0.1

export function computeBudget(project: Project, wall: Wall): BudgetResult {
  // Index upfront — O(1) lookup instead of find() O(n) in loops
  const moldingMap = new Map(project.moldings.map(m => [m.id, m]))
  const rosetteMap = new Map(project.rosettes.map(r => [r.id, r]))

  // Accumulators
  const linearMeters: Record<string, number> = {}
  const rosetteCount: Record<string, number> = {}

  // Process frames in each zone
  for (const zone of wall.zones) {
    const zoneRect = computeZoneRect(wall, zone.type)
    if (zone.frames.length === 0) continue
    const frameRects = computeFrameLayout(zone, zoneRect)

    for (let i = 0; i < zone.frames.length; i++) {
      const frame = zone.frames[i]!
      const rect = frameRects[i]!
      accumulateFrame(frame, rect, linearMeters, rosetteCount, moldingMap, rosetteMap)
    }
  }

  // Separator rail (no waste)
  const railData: { moldingId: string; meters: number } | null =
    wall.separator?.visible
      ? { moldingId: wall.separator.moldingId, meters: wall.dimensions.width / 100 }
      : null

  // Build budget lines for moldings
  const lines: BudgetLine[] = []
  const allMoldingIds = new Set([
    ...Object.keys(linearMeters),
    ...(railData ? [railData.moldingId] : []),
  ])

  for (const moldingId of allMoldingIds) {
    const molding = moldingMap.get(moldingId)
    if (!molding) continue

    const frameMeters = linearMeters[moldingId] ?? 0
    const railMeters = railData?.moldingId === moldingId ? railData.meters : 0

    // Frame portion: +15% waste
    const frameWastedMeters = frameMeters * FRAME_WASTE_FACTOR
    // Rail portion: no waste
    const totalMeters = frameWastedMeters + railMeters

    if (totalMeters === 0) continue

    const barLengthM = molding.barLength / 100
    const barsNeeded = Math.ceil(totalMeters / barLengthM)

    // Determine waste factor for display (1.15 if frames only, 1.0 if rail only)
    const wasteFactor = frameMeters > 0 ? FRAME_WASTE_FACTOR : 1.0

    lines.push({
      moldingId,
      moldingName: molding.name,
      linearMeters: frameMeters + railMeters,
      wasteFactor,
      barsNeeded,
      costPerBar: molding.pricePerBar,
      totalCost: barsNeeded * molding.pricePerBar,
    })
  }

  // Build rosette lines
  const rosetteLines: RosetteBudgetLine[] = Object.entries(rosetteCount)
    .map(([rosetteId, count]) => {
      const rosette = rosetteMap.get(rosetteId)
      if (!rosette) return null
      return {
        rosetteId,
        rosetteName: rosette.name,
        count,
        pricePerPiece: rosette.pricePerPiece,
        totalCost: count * rosette.pricePerPiece,
      }
    })
    .filter((item): item is RosetteBudgetLine => item !== null)

  const totalCost =
    lines.reduce((s, l) => s + l.totalCost, 0) +
    rosetteLines.reduce((s, r) => s + r.totalCost, 0)

  return { lines, rosetteLines, totalCost }
}

function accumulateFrame(
  frame: Frame,
  rect: Rect,
  linearMeters: Record<string, number>,
  rosetteCount: Record<string, number>,
  moldingMap: Map<string, Molding>,
  rosetteMap: Map<string, Rosette>,
): void {
  addPerimeter(frame.moldingId, rect, frame.cornerStyle, frame.rosetteId, linearMeters, rosetteCount, rosetteMap)

  // Nested levels: cumulative offset from outer frame border
  let cumulOffset = 0
  let previousMoldingId = frame.moldingId
  for (const level of frame.nestedLevels) {
    const parentMolding = moldingMap.get(previousMoldingId)
    cumulOffset += level.offset + (parentMolding ? parentMolding.width * MM_TO_CM : 0) // mm→cm
    const nestedRect = computeNestedRect(rect, cumulOffset)
    if (nestedRect.width <= 0 || nestedRect.height <= 0) break
    addPerimeter(level.moldingId, nestedRect, level.cornerStyle, level.rosetteId, linearMeters, rosetteCount, rosetteMap)
    previousMoldingId = level.moldingId
  }
}

function addPerimeter(
  moldingId: string,
  rect: Rect,
  cornerStyle: 'miter' | 'rosette',
  rosetteId: string | undefined,
  linearMeters: Record<string, number>,
  rosetteCount: Record<string, number>,
  rosetteMap: Map<string, Rosette>,
): void {
  let meters: number

  if (cornerStyle === 'rosette' && rosetteId) {
    const rosette = rosetteMap.get(rosetteId)
    if (rosette) {
      const straightW = rect.width - 2 * rosette.size
      const straightH = rect.height - 2 * rosette.size
      meters = (2 * (Math.max(0, straightW) + Math.max(0, straightH))) / 100
      rosetteCount[rosetteId] = (rosetteCount[rosetteId] ?? 0) + CORNERS_PER_FRAME
    } else {
      meters = 2 * (rect.width + rect.height) / 100
    }
  } else {
    meters = 2 * (rect.width + rect.height) / 100
  }

  linearMeters[moldingId] = (linearMeters[moldingId] ?? 0) + meters
}
