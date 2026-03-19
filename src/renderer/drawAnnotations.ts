import type { RenderContext } from './Renderer.js'
import { cm } from './scale.js'
import { computeFrameLayout, computeZoneRect } from '../services/layout.js'

export function drawAnnotations(rc: RenderContext): void {
  const { ctx, scale, ox, oy, wall } = rc
  ctx.fillStyle = '#222222'
  ctx.strokeStyle = '#444444'

  const fontSize = Math.max(9, Math.min(13, cm(4, scale)))
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.lineWidth = 0.5

  // Wall width annotation (top)
  drawDimensionLine(rc, ox, oy - 20, ox + cm(wall.dimensions.width, scale), oy - 20,
    `${wall.dimensions.width} cm`)

  // Wall height annotation (right)
  drawVerticalDimension(rc, ox + cm(wall.dimensions.width, scale) + 20, oy,
    ox + cm(wall.dimensions.width, scale) + 20, oy + cm(wall.dimensions.height, scale),
    `${wall.dimensions.height} cm`)

  // Frame annotations
  for (const zone of wall.zones) {
    if (zone.frames.length === 0) continue
    const zoneRect = computeZoneRect(wall, zone.type)
    const frameRects = computeFrameLayout(zone, zoneRect)
    for (const rect of frameRects) {
      const px = ox + cm(rect.x, scale)
      const py = oy + cm(rect.y, scale)
      const pw = cm(rect.width, scale)
      const ph = cm(rect.height, scale)
      // Frame width
      ctx.fillStyle = '#333'
      ctx.textAlign = 'center'
      ctx.fillText(`${Math.round(rect.width)} cm`, px + pw / 2, py - 6)
      // Frame height (rotated)
      ctx.save()
      ctx.translate(px - 6, py + ph / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(`${Math.round(rect.height)} cm`, 0, 0)
      ctx.restore()
    }
  }
}

function drawDimensionLine(
  rc: RenderContext,
  x1: number, y1: number,
  x2: number, y2: number,
  label: string
): void {
  const { ctx } = rc
  ctx.strokeStyle = '#666'
  ctx.lineWidth = 0.8
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#333'
  ctx.textAlign = 'center'
  ctx.fillText(label, (x1 + x2) / 2, y1 - 4)
}

function drawVerticalDimension(
  rc: RenderContext,
  x1: number, y1: number,
  x2: number, y2: number,
  label: string
): void {
  const { ctx } = rc
  ctx.strokeStyle = '#666'
  ctx.lineWidth = 0.8
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.save()
  ctx.translate(x1 + 14, (y1 + y2) / 2)
  ctx.rotate(Math.PI / 2)
  ctx.fillStyle = '#333'
  ctx.textAlign = 'center'
  ctx.fillText(label, 0, 0)
  ctx.restore()
}
