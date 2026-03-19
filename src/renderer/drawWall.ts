import { darken } from 'color2k'
import type { RenderContext } from './Renderer.js'
import { cm } from './scale.js'

export function drawWall(rc: RenderContext): void {
  const { ctx, scale, ox, oy, wall } = rc
  const { width, height, plinthHeight } = wall.dimensions

  // Wall background
  ctx.fillStyle = wall.colors.wall
  ctx.fillRect(ox, oy, cm(width, scale), cm(height, scale))

  // Plinth
  ctx.fillStyle = wall.colors.plinth
  const plinthY = oy + cm(height - plinthHeight, scale)
  ctx.fillRect(ox, plinthY, cm(width, scale), cm(plinthHeight, scale))

  // Thin top border for plinth — color2k : ratio 0-1 (20/255 ≈ 0.08)
  ctx.strokeStyle = darken(wall.colors.plinth, 0.08)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(ox, plinthY)
  ctx.lineTo(ox + cm(width, scale), plinthY)
  ctx.stroke()
}
