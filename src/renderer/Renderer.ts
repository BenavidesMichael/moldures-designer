import type { Wall, Project } from '../types/index.js'
import { computeScale, wallOffset } from './scale.js'
import { drawWall }        from './drawWall.js'
import { drawFrames }      from './drawFrames.js'
import { drawObstacles }   from './drawObstacles.js'
import { drawAnnotations } from './drawAnnotations.js'

export interface RenderContext {
  ctx: CanvasRenderingContext2D
  scale: number
  ox: number   // x offset for wall origin
  oy: number   // y offset for wall origin
  wall: Wall
  project: Project
}

// ── Camera (zoom — local to Renderer, not saved/undoable) ────────────────────
const _camera = { zoom: 1 }
let _lastCanvas:  HTMLCanvasElement | null = null
let _lastWall:    Wall | null = null
let _lastProject: Project | null = null

/** Reset zoom when switching to a new wall. */
export function resetZoom(): void {
  _camera.zoom = 1
}

/** Wire mouse-wheel zoom on the canvas. Call once after boot(). */
export function initZoom(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('wheel', e => {
    e.preventDefault()
    _camera.zoom = Math.max(0.2, Math.min(8, _camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1)))
    if (_lastCanvas && _lastWall && _lastProject) {
      renderWithState(_lastCanvas, _lastWall, _lastProject)
    }
  }, { passive: false })
}

export function setupCanvas(canvas: HTMLCanvasElement, container: HTMLElement): void {
  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = container.clientHeight
  canvas.width  = w * dpr
  canvas.height = h * dpr
  canvas.style.width  = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
}

/**
 * renderToCanvas — fonction PURE : pas de side-effects, pas de modification des _last*.
 * Utilisée par getHighResDataUrl() dans pdf.ts pour le rendu off-screen.
 * Le zoom n'est PAS appliqué (le PDF veut le rendu complet non-zoomé).
 */
export function renderToCanvas(canvas: HTMLCanvasElement, wall: Wall, project: Project): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const cssW = parseFloat(canvas.style.width)  || canvas.width
  const cssH = parseFloat(canvas.style.height) || canvas.height

  ctx.clearRect(0, 0, cssW, cssH)

  const scale = computeScale(
    { width: wall.dimensions.width, height: wall.dimensions.height },
    { width: cssW, height: cssH }
  )
  const { ox, oy } = wallOffset(
    { width: wall.dimensions.width, height: wall.dimensions.height },
    { width: cssW, height: cssH },
    scale
  )

  const rc: RenderContext = { ctx, scale, ox, oy, wall, project }
  drawWall(rc)
  drawObstacles(rc, false)
  drawFrames(rc)
  drawObstacles(rc, true)
  if (wall.showAnnotations) drawAnnotations(rc)
}

/**
 * renderWithState — rendu interactif avec zoom caméra + mémorisation _last*.
 * Appeler uniquement depuis le subscribe loop de index.ts (canvas visible).
 */
export function renderWithState(canvas: HTMLCanvasElement, wall: Wall, project: Project): void {
  _lastCanvas  = canvas
  _lastWall    = wall
  _lastProject = project

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const cssW = parseFloat(canvas.style.width)  || canvas.width
  const cssH = parseFloat(canvas.style.height) || canvas.height

  ctx.clearRect(0, 0, cssW, cssH)

  const scale = computeScale(
    { width: wall.dimensions.width, height: wall.dimensions.height },
    { width: cssW, height: cssH }
  )
  const { ox, oy } = wallOffset(
    { width: wall.dimensions.width, height: wall.dimensions.height },
    { width: cssW, height: cssH },
    scale
  )

  // Apply zoom centered on canvas midpoint
  ctx.save()
  const cx = cssW / 2
  const cy = cssH / 2
  ctx.translate(cx, cy)
  ctx.scale(_camera.zoom, _camera.zoom)
  ctx.translate(-cx, -cy)

  const rc: RenderContext = { ctx, scale, ox, oy, wall, project }
  drawWall(rc)
  drawObstacles(rc, false) // opaque obstacles
  drawFrames(rc)
  drawObstacles(rc, true)  // transparent obstacles on top
  if (wall.showAnnotations) drawAnnotations(rc)

  ctx.restore()
}
