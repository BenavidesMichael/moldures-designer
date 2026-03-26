import { darken } from 'color2k'
import type { RenderContext } from './Renderer.js'
import type { Obstacle } from '../types/index.js'
import { cm } from './scale.js'

// Constants for obstacle rendering
const TRANSPARENT_STROKE_COLOR = '#88aacc'
const TRANSPARENT_LINE_WIDTH = 1.5
const OPAQUE_BORDER_DARKEN = 0.12
const LABEL_COLOR = '#333333'
const LABEL_FONT_CM = 4
const LABEL_MIN_PX = 10

export function drawObstacles(rc: RenderContext, transparentOnly: boolean): void {
  for (const obstacle of rc.wall.obstacles) {
    if (obstacle.display.visible === false) continue
    if (obstacle.display.transparent !== transparentOnly) continue
    drawObstacle(rc, obstacle)
  }
}

function drawObstacle(rc: RenderContext, obstacle: Obstacle): void {
  const { ctx, scale, ox, oy, wall } = rc
  const { height: wh } = wall.dimensions

  // Convert from-floor Y to canvas Y
  const px = ox + cm(obstacle.positionX, scale)
  const py = oy + cm(wh - obstacle.positionY - obstacle.height, scale)
  const pw = cm(obstacle.width, scale)
  const ph = cm(obstacle.height, scale)

  if (obstacle.display.transparent) {
    // Draw window/transparent element: outline + cross lines
    ctx.strokeStyle = TRANSPARENT_STROKE_COLOR
    ctx.lineWidth = TRANSPARENT_LINE_WIDTH
    ctx.strokeRect(px, py, pw, ph)
    ctx.beginPath()
    ctx.moveTo(px, py); ctx.lineTo(px + pw, py + ph)
    ctx.moveTo(px + pw, py); ctx.lineTo(px, py + ph)
    ctx.stroke()
  } else {
    // Opaque fill
    const fillColor = obstacle.display.fillColor ?? '#cccccc'
    ctx.fillStyle = fillColor
    ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = darken(fillColor, OPAQUE_BORDER_DARKEN)
    ctx.lineWidth = 1
    ctx.strokeRect(px, py, pw, ph)
    // Label
    ctx.save()
    ctx.fillStyle = LABEL_COLOR
    ctx.font = `${Math.max(LABEL_MIN_PX, cm(LABEL_FONT_CM, scale))}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(obstacle.name, px + pw / 2, py + ph / 2)
    ctx.restore()
  }
}
