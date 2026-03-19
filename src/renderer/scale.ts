import type { Size } from '../types/index.js'

export function computeScale(wallCm: Size, containerPx: Size): number {
  const scaleX = containerPx.width  / wallCm.width
  const scaleY = containerPx.height / wallCm.height
  return Math.min(scaleX, scaleY) * 0.9
}

/** Convert cm to canvas pixels */
export function cm(value: number, scale: number): number {
  return value * scale
}

/** Wall offset in canvas so wall is centered */
export function wallOffset(wallCm: Size, containerPx: Size, scale: number): { ox: number; oy: number } {
  return {
    ox: (containerPx.width  - wallCm.width  * scale) / 2,
    oy: (containerPx.height - wallCm.height * scale) / 2,
  }
}
