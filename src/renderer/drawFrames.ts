import { lighten, darken } from 'color2k'
import type { RenderContext } from './Renderer.js'
import type { Frame, Rect, Molding } from '../types/index.js'
import { cm } from './scale.js'
import { computeFrameLayout, computeZoneRect, computeNestedRect } from '../services/layout.js'

const BEVEL_RATIO = 0.4
const BEVEL_MIN_PX = 2

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

  // Collision highlight (behind frame)
  if (hasCollisionWithAnyObstacle(rc, rect)) {
    const { ctx, scale, ox, oy } = rc
    ctx.save()
    ctx.strokeStyle = 'rgba(255,0,0,0.6)'
    ctx.lineWidth = 3
    ctx.strokeRect(ox + cm(rect.x, scale), oy + cm(rect.y, scale), cm(rect.width, scale), cm(rect.height, scale))
    ctx.restore()
  }

  // Outer frame ring — with or without rosettes
  const rosette = frame.cornerStyle === 'rosette' && frame.rosetteId
    ? rc.project.rosettes.find(r => r.id === frame.rosetteId)
    : undefined

  if (rosette) {
    drawRosetteFrame(rc, rect, molding, rosette.size)
  } else {
    drawBeveledBar(rc, rect, molding)
  }

  // Nested levels
  let cumulOffset = 0
  let previousMolding = molding
  for (const level of frame.nestedLevels) {
    cumulOffset += level.offset + previousMolding.width / 10
    const nestedRect = computeNestedRect(rect, cumulOffset)
    if (nestedRect.width <= 0 || nestedRect.height <= 0) break
    const nestedMolding = rc.project.moldings.find(m => m.id === level.moldingId)
    if (!nestedMolding) continue

    const nestedRosette = level.cornerStyle === 'rosette' && level.rosetteId
      ? rc.project.rosettes.find(r => r.id === level.rosetteId)
      : undefined

    if (nestedRosette) {
      drawRosetteFrame(rc, nestedRect, nestedMolding, nestedRosette.size)
    } else {
      drawBeveledBar(rc, nestedRect, nestedMolding)
    }
    previousMolding = nestedMolding
  }
}

/**
 * Draw a frame where each corner is replaced by a rosette square.
 * The 4 bars are drawn between the rosettes (not covering them).
 * rosetteSize is in cm (the rosette is square).
 */
function drawRosetteFrame(rc: RenderContext, rectCm: Rect, molding: Molding, rosetteSize: number): void {
  const { ctx, scale, ox, oy, wall } = rc
  const moldingColor = wall.colors.moldings !== '' ? wall.colors.moldings : molding.color
  const t  = cm(molding.width / 10, scale)   // bar thickness in px
  const rs = cm(rosetteSize, scale)           // rosette size in px
  const t2 = Math.max(BEVEL_MIN_PX, t * BEVEL_RATIO)

  const x = ox + cm(rectCm.x, scale)
  const y = oy + cm(rectCm.y, scale)
  const w = cm(rectCm.width,  scale)
  const h = cm(rectCm.height, scale)

  // ── 4 bars (no corners) ────────────────────────────────────────────────────
  const bars: Array<{ bx: number; by: number; bw: number; bh: number }> = [
    { bx: x + rs, by: y,          bw: w - 2 * rs, bh: t  },  // top
    { bx: x + rs, by: y + h - t,  bw: w - 2 * rs, bh: t  },  // bottom
    { bx: x,      by: y + rs,     bw: t,           bh: h - 2 * rs },  // left
    { bx: x + w - t, by: y + rs,  bw: t,           bh: h - 2 * rs },  // right
  ]

  for (const { bx, by, bw, bh } of bars) {
    if (bw <= 0 || bh <= 0) continue
    ctx.fillStyle = moldingColor
    ctx.fillRect(bx, by, bw, bh)
    // Simple bevel on bars
    ctx.fillStyle = lighten(moldingColor, 0.16)
    if (bh === t) {
      // horizontal bar — bevel top edge
      ctx.fillRect(bx, by, bw, Math.min(t2, bh / 2))
    } else {
      // vertical bar — bevel left edge
      ctx.fillRect(bx, by, Math.min(t2, bw / 2), bh)
    }
  }

  // ── 4 rosette squares ──────────────────────────────────────────────────────
  const corners = [
    { cx: x,          cy: y          },
    { cx: x + w - rs, cy: y          },
    { cx: x,          cy: y + h - rs },
    { cx: x + w - rs, cy: y + h - rs },
  ]

  const rosetteColor = lighten(moldingColor, 0.06)
  for (const { cx, cy } of corners) {
    // Base square
    ctx.fillStyle = rosetteColor
    ctx.fillRect(cx, cy, rs, rs)
    // Border
    ctx.strokeStyle = darken(moldingColor, 0.12)
    ctx.lineWidth = 1
    ctx.strokeRect(cx, cy, rs, rs)
    // Decorative inner square (8px inset or 20% of rosette size)
    const inset = Math.max(2, rs * 0.18)
    ctx.strokeStyle = darken(moldingColor, 0.08)
    ctx.lineWidth = 0.75
    ctx.strokeRect(cx + inset, cy + inset, rs - 2 * inset, rs - 2 * inset)
  }
}

export function drawBeveledBar(rc: RenderContext, rectCm: Rect, molding: Molding): void {
  const { ctx, scale, ox, oy, wall } = rc
  const moldingColor = wall.colors.moldings !== '' ? wall.colors.moldings : molding.color
  const t = cm(molding.thickness / 10, scale) // thickness in px (mm→cm→px)
  const t2 = Math.max(BEVEL_MIN_PX, t * BEVEL_RATIO) // bevel depth

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
