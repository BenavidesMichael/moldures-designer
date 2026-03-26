import { produce } from 'immer'
import type { Wall, Project, AnnotationFlags } from '../types/index.js'
export type { AnnotationFlags }
import { computeScale, wallOffset } from './scale.js'
import { drawWall }        from './drawWall.js'
import { drawFrames }      from './drawFrames.js'
import { drawObstacles }   from './drawObstacles.js'
import { drawAnnotations } from './drawAnnotations.js'
import { setState }        from '../state/AppState.js'

export interface RenderContext {
  ctx: CanvasRenderingContext2D
  scale: number
  ox: number   // x offset for wall origin
  oy: number   // y offset for wall origin
  wall: Wall
  project: Project
}

// ── Camera (zoom — local to Renderer, not saved/undoable) ───────────────────
const _camera = { zoom: 1 }
let _lastCanvas:  HTMLCanvasElement | null = null
let _lastWall:    Wall | null = null
let _lastProject: Project | null = null

// ── Drag state (obstacle drag — not saved until mouseup) ────────────────────
interface DragState {
  obstacleId: string
  offsetXcm: number   // cursor offset from obstacle left edge at grab
  offsetYcm: number   // cursor offset from obstacle top edge (canvas coords) at grab
}
let _drag: DragState | null = null

/** Reset zoom when switching to a new wall. */
export function resetZoom(): void {
  _camera.zoom = 1
}

/** Wire mouse-wheel zoom on the canvas. Call once after boot(). Returns a cleanup function. */
export function initZoom(canvas: HTMLCanvasElement): () => void {
  const handler = (e: WheelEvent) => {
    e.preventDefault()
    _camera.zoom = Math.max(0.2, Math.min(8, _camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1)))
    if (_lastCanvas && _lastWall && _lastProject) {
      renderWithState(_lastCanvas, _lastWall, _lastProject)
    }
  }
  canvas.addEventListener('wheel', handler, { passive: false })
  return () => canvas.removeEventListener('wheel', handler)
}

/**
 * Wire obstacle drag-and-drop on the canvas. Call once after boot().
 * Returns a cleanup function.
 */
export function initDrag(canvas: HTMLCanvasElement): () => void {
  function getMetrics(): { scale: number; ox: number; oy: number; cssW: number; cssH: number } | null {
    if (!_lastWall) return null
    const cssW = parseFloat(canvas.style.width)  || canvas.width
    const cssH = parseFloat(canvas.style.height) || canvas.height
    const scale = computeScale(
      { width: _lastWall.dimensions.width, height: _lastWall.dimensions.height },
      { width: cssW, height: cssH }
    )
    const { ox, oy } = wallOffset(
      { width: _lastWall.dimensions.width, height: _lastWall.dimensions.height },
      { width: cssW, height: cssH },
      scale
    )
    return { scale, ox, oy, cssW, cssH }
  }

  /** Convert a CSS-pixel point on the canvas to wall cm coordinates (Y = from top). */
  function pixToCmTop(px: number, py: number): { xCm: number; yTopCm: number } | null {
    const m = getMetrics()
    if (!m) return null
    const cx = m.cssW / 2
    const cy = m.cssH / 2
    // Undo zoom: ctx.translate(cx,cy) → ctx.scale(zoom) → ctx.translate(-cx,-cy)
    const wx = (px - cx) / _camera.zoom + cx - m.ox
    const wy = (py - cy) / _camera.zoom + cy - m.oy
    return { xCm: wx / m.scale, yTopCm: wy / m.scale }
  }

  function onMouseDown(e: MouseEvent): void {
    if (!_lastWall) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const pos = pixToCmTop(mx, my)
    if (!pos) return
    const { xCm, yTopCm } = pos
    const wh = _lastWall.dimensions.height

    // Find topmost obstacle (drawn last = transparent, so reverse order)
    for (let i = _lastWall.obstacles.length - 1; i >= 0; i--) {
      const o = _lastWall.obstacles[i]
      if (o.display.visible === false) continue
      // positionY is from floor; convert to from-top
      const oTopCm = wh - o.positionY - o.height
      if (
        xCm >= o.positionX && xCm <= o.positionX + o.width &&
        yTopCm >= oTopCm   && yTopCm <= oTopCm + o.height
      ) {
        _drag = {
          obstacleId: o.id,
          offsetXcm:  xCm - o.positionX,
          offsetYcm:  yTopCm - oTopCm,
        }
        canvas.style.cursor = 'grabbing'
        break
      }
    }
  }

  function onMouseMove(e: MouseEvent): void {
    if (!_drag || !_lastWall || !_lastCanvas || !_lastProject) return
    const rect = canvas.getBoundingClientRect()
    const pos  = pixToCmTop(e.clientX - rect.left, e.clientY - rect.top)
    if (!pos) return

    const obs = _lastWall.obstacles.find(o => o.id === _drag!.obstacleId)
    if (!obs) return

    const ww = _lastWall.dimensions.width
    const wh = _lastWall.dimensions.height
    const newXcm = Math.max(0, Math.min(ww - obs.width,  pos.xCm   - _drag.offsetXcm))
    const newYtop = Math.max(0, Math.min(wh - obs.height, pos.yTopCm - _drag.offsetYcm))
    const newYfloor = wh - newYtop - obs.height

    // Build a temporary wall with the moved obstacle for live preview
    const previewWall: Wall = produce(_lastWall, draft => {
      const o = draft.obstacles.find(x => x.id === _drag!.obstacleId)
      if (o) { o.positionX = Math.round(newXcm); o.positionY = Math.round(newYfloor) }
    })
    // Render preview directly (no setState → no history entry)
    _lastWall = previewWall
    renderWithState(_lastCanvas, previewWall, _lastProject)
  }

  function onMouseUp(e: MouseEvent): void {
    if (!_drag || !_lastWall) { _drag = null; canvas.style.cursor = ''; return }
    const rect = canvas.getBoundingClientRect()
    const pos  = pixToCmTop(e.clientX - rect.left, e.clientY - rect.top)

    if (pos) {
      const obs = _lastWall.obstacles.find(o => o.id === _drag!.obstacleId)
      if (obs) {
        const ww = _lastWall.dimensions.width
        const wh = _lastWall.dimensions.height
        const newXcm   = Math.max(0, Math.min(ww - obs.width,  pos.xCm   - _drag!.offsetXcm))
        const newYtop  = Math.max(0, Math.min(wh - obs.height, pos.yTopCm - _drag!.offsetYcm))
        const newYfloor = wh - newYtop - obs.height
        const finalX = Math.round(newXcm)
        const finalY = Math.round(newYfloor)

        // Commit to state (creates undo entry)
        setState(s => produce(s, draft => {
          const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
          if (!w) return
          const o = w.obstacles.find(x => x.id === _drag!.obstacleId)
          if (o) { o.positionX = finalX; o.positionY = finalY }
        }))
      }
    }
    _drag = null
    canvas.style.cursor = ''
  }

  function onMouseLeave(): void {
    if (_drag && _lastWall && _lastCanvas && _lastProject) {
      // Commit current position on mouse leave
      setState(s => produce(s, draft => {
        const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
        if (!w || !_drag) return
        const obs = _lastWall!.obstacles.find(o => o.id === _drag!.obstacleId)
        if (!obs) return
        const o = w.obstacles.find(x => x.id === _drag!.obstacleId)
        if (o) { o.positionX = obs.positionX; o.positionY = obs.positionY }
      }))
    }
    _drag = null
    canvas.style.cursor = ''
  }

  // Hover cursor feedback
  function onMouseMoveHover(e: MouseEvent): void {
    if (_drag) return
    if (!_lastWall) return
    const rect = canvas.getBoundingClientRect()
    const pos  = pixToCmTop(e.clientX - rect.left, e.clientY - rect.top)
    if (!pos) { canvas.style.cursor = ''; return }
    const { xCm, yTopCm } = pos
    const wh = _lastWall.dimensions.height
    const hit = _lastWall.obstacles.some(o => {
      if (o.display.visible === false) return false
      const oTopCm = wh - o.positionY - o.height
      return xCm >= o.positionX && xCm <= o.positionX + o.width
          && yTopCm >= oTopCm   && yTopCm <= oTopCm + o.height
    })
    canvas.style.cursor = hit ? 'grab' : ''
  }

  canvas.addEventListener('mousedown',  onMouseDown)
  canvas.addEventListener('mousemove',  onMouseMove)
  canvas.addEventListener('mousemove',  onMouseMoveHover)
  canvas.addEventListener('mouseup',    onMouseUp)
  canvas.addEventListener('mouseleave', onMouseLeave)

  return () => {
    canvas.removeEventListener('mousedown',  onMouseDown)
    canvas.removeEventListener('mousemove',  onMouseMove)
    canvas.removeEventListener('mousemove',  onMouseMoveHover)
    canvas.removeEventListener('mouseup',    onMouseUp)
    canvas.removeEventListener('mouseleave', onMouseLeave)
  }
}

export function setupCanvas(canvas: HTMLCanvasElement, container: HTMLElement): void {
  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = container.clientHeight
  canvas.width  = w * dpr
  canvas.height = h * dpr
  canvas.style.width  = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')
  if (!ctx) return
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
  drawAnnotations(rc, wall.annotations)
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
  drawAnnotations(rc, wall.annotations)

  ctx.restore()
}
