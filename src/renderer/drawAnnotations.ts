import type { RenderContext, AnnotationFlags } from './Renderer.js'
import type { FrameRect } from '../types/index.js'
import { cm } from './scale.js'
import { computeFrameLayout, computeZoneRect, computeNestedRect } from '../services/layout.js'

// ── Layout constants (px) ────────────────────────────────────────────────────
const OUTER_OFFSET  = 28  // dimension line distance from wall edge
const ARROW_SIZE    = 5   // half-length of end ticks
const OBS_OFFSET    = 16  // inner dimension line distance from obstacle edge
const LABEL_BG      = 'rgba(243,239,232,0.88)' // --color-bg
const WALL_DIM_FONT_SCALE = 5   // cm → px font size for total wall dims
const WALL_DIM_MIN  = 12
const FRAME_DIM_FONT_SCALE  = 3.5
const FRAME_DIM_MIN         = 9
const NESTED_DIM_FONT_SCALE = 2.8
const NESTED_DIM_MIN        = 7
const OBS_DIM_FONT_SCALE = 3.2
const OBS_DIM_MIN   = 9
const SPACE_FONT_SCALE = 3.0
const SPACE_FONT_MIN   = 8
// Space annotation colors
const COLOR_MARGIN  = '#7a5c1e'  // brun foncé — marges (hors-cadre)
const COLOR_GAP     = '#3a7a4a'  // vert — espace entre cadres
const COLOR_FRAME   = '#333'
const COLOR_NESTED  = '#3a5c8a'  // bleu — sous-cadres
const COLOR_OBS_SZ  = '#447'
const COLOR_OBS_H   = '#844'
const COLOR_OBS_V   = '#484'
const COLOR_WALL    = '#333'
const COLOR_PLINTH  = '#888'

export function drawAnnotations(rc: RenderContext, flags: AnnotationFlags): void {
  const { ctx, scale, ox, oy, wall } = rc
  const { width: ww, height: wh } = wall.dimensions
  const wPx = cm(ww, scale)
  const hPx = cm(wh, scale)

  // ── 1. Total wall dimensions ────────────────────────────────────────────────
  if (flags.wallDimensions) {
    const wallFontPx = Math.max(WALL_DIM_MIN, Math.min(18, cm(WALL_DIM_FONT_SCALE, scale)))
    drawHDimLine(rc, ox, ox + wPx, oy - OUTER_OFFSET,       `${ww} cm`, wallFontPx, COLOR_WALL, 2)
    drawHDimLine(rc, ox, ox + wPx, oy + hPx + OUTER_OFFSET, `${ww} cm`, wallFontPx, COLOR_WALL, 2)
    drawVDimLine(rc, ox - OUTER_OFFSET,       oy, oy + hPx, `${wh} cm`, wallFontPx, COLOR_WALL, 2)
    drawVDimLine(rc, ox + wPx + OUTER_OFFSET, oy, oy + hPx, `${wh} cm`, wallFontPx, COLOR_WALL, 2)
  }

  // ── 2. Plinth ───────────────────────────────────────────────────────────────
  if (flags.plinth && wall.dimensions.plinthHeight > 0) {
    const plinthFontPx = Math.max(SPACE_FONT_MIN, Math.min(11, cm(SPACE_FONT_SCALE, scale)))
    const plinthY = oy + cm(wh - wall.dimensions.plinthHeight, scale)
    drawVDimLine(rc, ox + wPx + OUTER_OFFSET + 20, plinthY, oy + hPx,
      `Plinthe ${wall.dimensions.plinthHeight} cm`, plinthFontPx, COLOR_PLINTH, 1)
  }

  // ── 3. Obstacle dimensions & positions ─────────────────────────────────────
  if (flags.obstacles) {
    const obsFontPx = Math.max(OBS_DIM_MIN, Math.min(11, cm(OBS_DIM_FONT_SCALE, scale)))
    for (const obs of wall.obstacles) {
      if (obs.display.visible === false) continue
      const px = ox + cm(obs.positionX, scale)
      const py = oy + cm(wh - obs.positionY - obs.height, scale)
      const pw = cm(obs.width, scale)
      const ph = cm(obs.height, scale)
      drawHDimLine(rc, px, px + pw, py - OBS_OFFSET, `${obs.width} cm`,  obsFontPx, COLOR_OBS_SZ, 1)
      drawVDimLine(rc, px - OBS_OFFSET, py, py + ph, `${obs.height} cm`, obsFontPx, COLOR_OBS_SZ, 1)
      if (obs.positionX > 0)
        drawHDimLine(rc, ox, px, py + ph / 2, `${obs.positionX} cm`, obsFontPx, COLOR_OBS_H, 1)
      const distRight = ww - obs.positionX - obs.width
      if (distRight > 0)
        drawHDimLine(rc, px + pw, ox + wPx, py + ph / 2, `${distRight} cm`, obsFontPx, COLOR_OBS_H, 1)
      if (obs.positionY > 0)
        drawVDimLine(rc, px + pw + OBS_OFFSET, py + ph, oy + hPx, `${obs.positionY} cm`, obsFontPx, COLOR_OBS_V, 1)
      const distCeiling = wh - obs.positionY - obs.height
      if (distCeiling > 0)
        drawVDimLine(rc, px + pw + OBS_OFFSET, oy, py, `${distCeiling} cm`, obsFontPx, COLOR_OBS_V, 1)
    }
  }

  // ── 4. Frame dimensions + spaces ────────────────────────────────────────────
  const frameFontPx = Math.max(FRAME_DIM_MIN, Math.min(13, cm(FRAME_DIM_FONT_SCALE, scale)))
  const spaceFontPx = Math.max(SPACE_FONT_MIN, Math.min(10, cm(SPACE_FONT_SCALE, scale)))
  ctx.fillStyle = COLOR_FRAME

  for (const zone of wall.zones) {
    if (zone.frames.length === 0) continue
    const zoneRect   = computeZoneRect(wall, zone.type)
    const frameRects = computeFrameLayout(zone, zoneRect)

    if (flags.frameDimensions) {
      const nestedFontPx = Math.max(NESTED_DIM_MIN, Math.min(10, cm(NESTED_DIM_FONT_SCALE, scale)))

      for (let fi = 0; fi < frameRects.length; fi++) {
        const rect  = frameRects[fi]
        const frame = zone.frames[fi]
        const fpx = ox + cm(rect.x, scale)
        const fpy = oy + cm(rect.y, scale)
        const fpw = cm(rect.width, scale)
        const fph = cm(rect.height, scale)

        // Outer frame dimensions — above and left
        drawLabel(rc, `${Math.round(rect.width)} cm`, fpx + fpw / 2, fpy - 5, frameFontPx, COLOR_FRAME)
        ctx.save()
        ctx.translate(fpx - 5, fpy + fph / 2)
        ctx.rotate(-Math.PI / 2)
        drawLabel(rc, `${Math.round(rect.height)} cm`, 0, 0, frameFontPx, COLOR_FRAME)
        ctx.restore()

        // Nested level dimensions + offset gaps
        if (frame) {
          let cumulOffset = 0
          let prevMolding = rc.project.moldings.find(m => m.id === frame.moldingId)
          for (const level of frame.nestedLevels) {
            if (!prevMolding) break
            const prevBarInnerOffset = cumulOffset + prevMolding.width / 10  // inner edge of prev bar
            cumulOffset += level.offset + prevMolding.width / 10
            const nr = computeNestedRect(rect, cumulOffset)
            if (nr.width <= 0 || nr.height <= 0) break
            const npx = ox + cm(nr.x, scale)
            const npy = oy + cm(nr.y, scale)
            const npw = cm(nr.width, scale)
            const nph = cm(nr.height, scale)

            // Nested rect width/height — inside the rect
            drawLabel(rc, `${Math.round(nr.width)} cm`,  npx + npw / 2,         npy + nestedFontPx + 3, nestedFontPx, COLOR_NESTED)
            ctx.save()
            ctx.translate(npx + nestedFontPx + 3, npy + nph / 2)
            ctx.rotate(-Math.PI / 2)
            drawLabel(rc, `${Math.round(nr.height)} cm`, 0, 0, nestedFontPx, COLOR_NESTED)
            ctx.restore()

            // Offset gap — top side: from inner edge of prev bar to outer edge of this bar
            if (level.offset > 0) {
              const gapX1 = fpx + cm(prevBarInnerOffset, scale)
              const gapX2 = fpx + cm(cumulOffset, scale)
              const gapY  = fpy + fph - nestedFontPx * 2 - 4
              drawHDimLine(rc, gapX1, gapX2, gapY,
                `${level.offset} cm`, nestedFontPx, '#c07040', 1)
            }

            prevMolding = rc.project.moldings.find(m => m.id === level.moldingId)
          }
        }
      }
    }

    if (flags.spaces) {
      drawZoneSpaces(rc, zone.layout.marginLeft, zone.layout.marginRight,
        zone.layout.marginTop, zone.layout.marginBottom,
        zone.layout.gapBetweenFrames, zoneRect, frameRects, spaceFontPx)
    }
  }
}

// ── Zone space chain ─────────────────────────────────────────────────────────

function drawZoneSpaces(
  rc: RenderContext,
  marginLeft: number, marginRight: number,
  marginTop: number, marginBottom: number,
  gap: number,
  zoneRect: { x: number; y: number; width: number; height: number },
  frameRects: FrameRect[],
  fontPx: number,
): void {
  if (frameRects.length === 0) return
  const { ox, oy, scale } = rc

  const zoneLeftPx   = ox + cm(zoneRect.x, scale)
  const zoneTopPx    = oy + cm(zoneRect.y, scale)
  const zoneBottomPx = oy + cm(zoneRect.y + zoneRect.height, scale)

  const firstFrame = frameRects[0]
  const lastFrame  = frameRects[frameRects.length - 1]

  const fTopPx  = oy + cm(firstFrame.y, scale)
  const fBotPx  = oy + cm(firstFrame.y + firstFrame.height, scale)
  const fMidY   = (fTopPx + fBotPx) / 2   // horizontal lines pass here

  // ── Horizontal: left margin ────────────────────────────────────────────────
  if (marginLeft > 0) {
    const x1 = zoneLeftPx
    const x2 = ox + cm(firstFrame.x, scale)
    drawHDimLine(rc, x1, x2, fMidY, `${Math.round(marginLeft)} cm`, fontPx, COLOR_MARGIN, 1)
  }

  // ── Horizontal: gaps between consecutive frames ────────────────────────────
  if (gap > 0) {
    for (let i = 1; i < frameRects.length; i++) {
      const prev = frameRects[i - 1]
      const curr = frameRects[i]
      const gx1  = ox + cm(prev.x + prev.width, scale)
      const gx2  = ox + cm(curr.x, scale)
      if (Math.abs(gx2 - gx1) > 4)
        drawHDimLine(rc, gx1, gx2, fMidY, `${Math.round(gap)} cm`, fontPx, COLOR_GAP, 1)
    }
  }

  // ── Horizontal: right margin ───────────────────────────────────────────────
  if (marginRight > 0) {
    const x1 = ox + cm(lastFrame.x + lastFrame.width, scale)
    const x2 = zoneLeftPx + cm(zoneRect.width, scale)
    drawHDimLine(rc, x1, x2, fMidY, `${Math.round(marginRight)} cm`, fontPx, COLOR_MARGIN, 1)
  }

  // ── Vertical: top margin — drawn just left of the first frame ─────────────
  const vX = ox + cm(firstFrame.x, scale) - 10
  if (marginTop > 0)
    drawVDimLine(rc, vX, zoneTopPx, fTopPx,
      `${Math.round(marginTop)} cm`, fontPx, COLOR_MARGIN, 1)

  // ── Vertical: bottom margin — drawn just left of the first frame ──────────
  if (marginBottom > 0)
    drawVDimLine(rc, vX, fBotPx, zoneBottomPx,
      `${Math.round(marginBottom)} cm`, fontPx, COLOR_MARGIN, 1)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function drawHDimLine(
  rc: RenderContext,
  x1: number, x2: number,
  y: number,
  label: string,
  fontPx: number,
  color: string,
  lineWidth: number
): void {
  const { ctx } = rc
  if (Math.abs(x2 - x1) < 4) return

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle   = color
  ctx.lineWidth   = lineWidth
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(x1, y); ctx.lineTo(x2, y)
  ctx.stroke()
  ctx.setLineDash([])
  ;[x1, x2].forEach(x => {
    ctx.beginPath()
    ctx.moveTo(x, y - ARROW_SIZE); ctx.lineTo(x, y + ARROW_SIZE)
    ctx.stroke()
  })
  drawLabel(rc, label, (x1 + x2) / 2, y - 5, fontPx, color)
  ctx.restore()
}

function drawVDimLine(
  rc: RenderContext,
  x: number,
  y1: number, y2: number,
  label: string,
  fontPx: number,
  color: string,
  lineWidth: number
): void {
  const { ctx } = rc
  if (Math.abs(y2 - y1) < 4) return

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle   = color
  ctx.lineWidth   = lineWidth
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(x, y1); ctx.lineTo(x, y2)
  ctx.stroke()
  ctx.setLineDash([])
  ;[y1, y2].forEach(y => {
    ctx.beginPath()
    ctx.moveTo(x - ARROW_SIZE, y); ctx.lineTo(x + ARROW_SIZE, y)
    ctx.stroke()
  })
  ctx.save()
  ctx.translate(x + 5, (y1 + y2) / 2)
  ctx.rotate(Math.PI / 2)
  drawLabel(rc, label, 0, 0, fontPx, color)
  ctx.restore()
  ctx.restore()
}

function drawLabel(
  rc: RenderContext,
  text: string,
  x: number, y: number,
  fontPx: number,
  color: string
): void {
  const { ctx } = rc
  ctx.save()
  ctx.font = `${fontPx}px sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  const tw  = ctx.measureText(text).width
  const pad = 2
  ctx.fillStyle = LABEL_BG
  ctx.fillRect(x - tw / 2 - pad, y - fontPx / 2 - pad, tw + pad * 2, fontPx + pad * 2)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}
