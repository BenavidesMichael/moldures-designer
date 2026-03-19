import type { Zone, Wall, Rect, FrameRect } from '../types/index.js'

/**
 * Computes the canvas rectangle (in cm) for a zone on the wall.
 * Y=0 is the top of the drawable area (just above the plinth).
 */
export function computeZoneRect(wall: Wall, zoneType: Zone['type']): Rect {
  const usableHeight = wall.dimensions.height - wall.dimensions.plinthHeight

  if (zoneType === 'full' || !wall.separator) {
    return { x: 0, y: 0, width: wall.dimensions.width, height: usableHeight }
  }

  const separatorY = usableHeight * (wall.separator.positionPercent / 100)

  if (zoneType === 'top') {
    return { x: 0, y: 0, width: wall.dimensions.width, height: separatorY }
  }

  // bottom
  return {
    x: 0,
    y: separatorY,
    width: wall.dimensions.width,
    height: usableHeight - separatorY,
  }
}

/**
 * Computes frame positions and sizes (in cm) within a zone.
 * This is the single source of truth used by both the renderer and budget.
 */
export function computeFrameLayout(zone: Zone, zoneRect: Rect): FrameRect[] {
  const { layout } = zone
  const availableWidth  = zoneRect.width  - layout.marginLeft - layout.marginRight
  const availableHeight = zoneRect.height - layout.marginTop  - layout.marginBottom
  const totalGapWidth   = Math.max(0, layout.frameCount - 1) * layout.gapBetweenFrames

  // Un seul reduce au lieu de deux filter/reduce successifs — O(n) unique
  const { fixedWidths, autoCount } = layout.customWidths
    .slice(0, layout.frameCount)
    .reduce(
      (acc, w) => w > 0
        ? { fixedWidths: acc.fixedWidths + w, autoCount: acc.autoCount }
        : { fixedWidths: acc.fixedWidths,     autoCount: acc.autoCount + 1 },
      { fixedWidths: 0, autoCount: 0 },
    )

  const autoWidth = autoCount > 0
    ? (availableWidth - totalGapWidth - fixedWidths) / autoCount
    : 0

  let currentX = zoneRect.x + layout.marginLeft

  return Array.from({ length: layout.frameCount }, (_, i) => {
    const customW = layout.customWidths[i]  ?? 0
    const customH = layout.customHeights[i] ?? 0
    const frameWidth  = customW > 0 ? customW : autoWidth
    const frameHeight = customH > 0 ? customH : availableHeight
    const frameY = zoneRect.y + layout.marginTop + (availableHeight - frameHeight) / 2

    const rect: FrameRect = {
      frameIndex: i,
      x: currentX,
      y: frameY,
      width: frameWidth,
      height: frameHeight,
    }
    currentX += frameWidth + layout.gapBetweenFrames
    return rect
  })
}

/**
 * Computes the rectangle of a nested frame level.
 * cumulativeOffset is the total inset from the outermost frame border.
 */
export function computeNestedRect(parentRect: Rect, cumulativeOffset: number): Rect {
  return {
    x: parentRect.x + cumulativeOffset,
    y: parentRect.y + cumulativeOffset,
    width:  parentRect.width  - 2 * cumulativeOffset,
    height: parentRect.height - 2 * cumulativeOffset,
  }
}
