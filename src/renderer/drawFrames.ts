import { lighten, darken } from 'color2k'
import type { RenderContext } from './Renderer.js'
import type { Frame, Rect, Molding } from '../types/index.js'
import { cm } from './scale.js'
import { computeFrameLayout, computeZoneRect, computeNestedRect } from '../services/layout.js'

export function drawFrames(rc: RenderContext): void {
  const { wall, project } = rc

  for (const zone of wall.zones) {
    const zoneRect = computeZoneRect(wall, zone.type)
    if (zone.frames.length === 0) continue
    const frameRects = computeFrameLayout(zone, zoneRect)

    for (let i = 0; i < zone.frames.length; i++) {
      const frame = zone.frames[i]!
      const rect  = frameRects[i]!
      drawFrame(rc, frame, rect, project.moldings)
    }
  }

  // Separator rail
  if (wall.separator?.visible) {
    const molding = project.moldings.find(m => m.id === wall.separator!.moldingId)
    if (molding) {
      const usableH = wall.dimensions.height - wall.dimensions.plinthHeight
      const sepY = usableH * (wall.separator.positionPercent / 100)
      const railRect: Rect = { x: 0, y: sepY, width: wall.dimensions.width, height: molding.width / 10 }
      drawBeveledBar(rc, railRect, molding)
    }
  }
}

function drawFrame(rc: RenderContext, frame: Frame, rect: Rect, moldings: Molding[]): void {
  const molding = moldings.find(m => m.id === frame.moldingId)
  if (!molding) return

  // Draw collision highlight first (behind frame)
  if (hasCollisionWithAnyObstacle(rc, rect)) {
    const { ctx, scale, ox, oy } = rc
    ctx.strokeStyle = 'rgba(255,0,0,0.6)'
    ctx.lineWidth = 3
    ctx.strokeRect(ox + cm(rect.x, scale), oy + cm(rect.y, scale), cm(rect.width, scale), cm(rect.height, scale))
  }

  drawBeveledBar(rc, rect, molding)

  // Nested levels
  let cumulOffset = 0
  for (const level of frame.nestedLevels) {
    cumulOffset += level.offset + molding.width / 10
    const nestedRect = computeNestedRect(rect, cumulOffset)
    if (nestedRect.width <= 0 || nestedRect.height <= 0) break
    const nestedMolding = rc.project.moldings.find(m => m.id === level.moldingId)
    if (nestedMolding) drawBeveledBar(rc, nestedRect, nestedMolding)
  }
}

export function drawBeveledBar(rc: RenderContext, rectCm: Rect, molding: Molding): void {
  const { ctx, scale, ox, oy, wall } = rc
  const moldingColor = wall.colors.moldings !== '' ? wall.colors.moldings : molding.color
  const t = cm(molding.thickness / 10, scale) // thickness in px (mm→cm→px)
  const t2 = Math.max(2, t * 0.4)             // bevel depth

  const x = ox + cm(rectCm.x, scale)
  const y = oy + cm(rectCm.y, scale)
  const w = cm(rectCm.width, scale)
  const h = cm(rectCm.height, scale)

  // Outer rectangle (the frame face)
  ctx.fillStyle = moldingColor
  ctx.fillRect(x, y, w, t)           // top bar
  ctx.fillRect(x, y + h - t, w, t)  // bottom bar
  ctx.fillRect(x, y, t, h)           // left bar
  ctx.fillRect(x + w - t, y, t, h)  // right bar

  // Bevel — top/left faces (lighter) — color2k : ratio 0-1
  ctx.fillStyle = lighten(moldingColor, 0.16)
  // Top bar — inner bevel
  drawTrapezoid(ctx, x, y, x + w, y, x + w - t2, y + t2, x + t2, y + t2)
  // Left bar — inner bevel
  drawTrapezoid(ctx, x, y, x + t2, y + t2, x + t2, y + h - t2, x, y + h)

  // Bevel — bottom/right faces (darker) — color2k : ratio 0-1
  ctx.fillStyle = darken(moldingColor, 0.16)
  // Bottom bar — inner bevel
  drawTrapezoid(ctx, x + t2, y + h - t2, x + w - t2, y + h - t2, x + w, y + h, x, y + h)
  // Right bar — inner bevel
  drawTrapezoid(ctx, x + w - t2, y + t2, x + w, y, x + w, y + h, x + w - t2, y + h - t2)
}

function drawTrapezoid(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): void {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.lineTo(x4, y4)
  ctx.closePath()
  ctx.fill()
}

function hasCollisionWithAnyObstacle(rc: RenderContext, frameCm: Rect): boolean {
  for (const obs of rc.wall.obstacles) {
    const obsRect: Rect = {
      x: obs.positionX,
      y: rc.wall.dimensions.height - obs.positionY - obs.height,
      width: obs.width,
      height: obs.height,
    }
    if (rectsOverlap(frameCm, obsRect)) return true
  }
  return false
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.x + a.width < b.x || a.x > b.x + b.width ||
           a.y + a.height < b.y || a.y > b.y + b.height)
}
