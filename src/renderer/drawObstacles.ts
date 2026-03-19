import { darken } from 'color2k'
import type { RenderContext } from './Renderer.js'
import type { Obstacle } from '../types/index.js'
import { cm } from './scale.js'

export function drawObstacles(rc: RenderContext, transparentOnly: boolean): void {
  for (const obstacle of rc.wall.obstacles) {
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
    ctx.strokeStyle = '#88aacc'
    ctx.lineWidth = 1.5
    ctx.strokeRect(px, py, pw, ph)
    ctx.beginPath()
    ctx.moveTo(px, py); ctx.lineTo(px + pw, py + ph)
    ctx.moveTo(px + pw, py); ctx.lineTo(px, py + ph)
    ctx.stroke()
  } else {
    // Opaque fill
    ctx.fillStyle = obstacle.display.fillColor ?? '#cccccc'
    ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = darken(obstacle.display.fillColor ?? '#cccccc', 0.12)
    ctx.lineWidth = 1
    ctx.strokeRect(px, py, pw, ph)
    // Label
    ctx.fillStyle = '#333333'
    ctx.font = `${Math.max(10, cm(4, scale))}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(obstacle.name, px + pw / 2, py + ph / 2)
  }
}
