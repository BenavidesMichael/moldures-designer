// ─── Geometry ──────────────────────────────────────────────────────────────
export interface Size { width: number; height: number }
export interface Rect { x: number; y: number; width: number; height: number }

// ─── Project ───────────────────────────────────────────────────────────────
export interface Project {
  id: string
  version: number
  name: string
  createdAt: string
  walls: Wall[]
  activeWallId: string
  moldings: Molding[]
  rosettes: Rosette[]
}

// ─── Wall ──────────────────────────────────────────────────────────────────
export interface Wall {
  id: string
  name: string
  dimensions: WallDimensions
  zoneMode: '1zone' | '2zones'
  zones: Zone[]
  separator?: Separator
  archivedBottomZone?: Zone
  obstacles: Obstacle[]
  colors: WallColors
  showAnnotations: boolean
}

export interface WallDimensions {
  width: number      // cm
  height: number     // cm
  plinthHeight: number // cm
}

export interface WallColors {
  wall: string       // hex — fond du mur
  moldings: string   // hex ou '' ('' = utiliser Molding.color individuelle)
  plinth: string     // hex — plinthe
}

// ─── Zone ──────────────────────────────────────────────────────────────────
export interface Zone {
  id: string
  type: 'top' | 'bottom' | 'full'
  layout: ZoneLayout
  frames: Frame[]
}

export interface ZoneLayout {
  frameCount: number
  marginTop: number      // cm
  marginBottom: number   // cm
  marginLeft: number     // cm
  marginRight: number    // cm
  gapBetweenFrames: number // cm
  customWidths: number[] // length === frameCount, 0 = auto
  customHeights: number[]// length === frameCount, 0 = auto
}

// ─── Frame ─────────────────────────────────────────────────────────────────
export interface Frame {
  id: string
  moldingId: string
  cornerStyle: 'miter' | 'rosette'
  rosetteId?: string
  nestedLevels: NestedLevel[]
}

export interface NestedLevel {
  offset: number   // cm depuis bord intérieur cadre parent
  moldingId: string
  cornerStyle: 'miter' | 'rosette'
  rosetteId?: string
}

// ─── Molding & Rosette ─────────────────────────────────────────────────────
export interface Molding {
  id: string
  name: string
  reference: string
  width: number      // mm
  thickness: number  // mm
  barLength: number  // cm
  pricePerBar: number // €
  color: string      // hex
}

export interface Rosette {
  id: string
  name: string
  reference: string
  size: number         // cm (carré)
  pricePerPiece: number // €
}

// ─── Separator ─────────────────────────────────────────────────────────────
export interface Separator {
  positionPercent: number // % de la hauteur utile depuis le haut
  visible: boolean
  moldingId: string
}

// ─── Obstacle ──────────────────────────────────────────────────────────────
export type ObstacleType =
  | 'window' | 'door' | 'radiator'
  | 'outlet' | 'switch' | 'fireplace' | 'custom'

export type ObstacleTexture = 'wood' | 'glass' | 'brick' | 'metal'

export interface Obstacle {
  id: string
  name: string
  type: ObstacleType
  width: number    // cm
  height: number   // cm
  positionX: number // cm depuis bord gauche
  positionY: number // cm depuis le SOL
  display: ObstacleDisplay
}

export interface ObstacleDisplay {
  transparent: boolean
  fillColor?: string
  texture?: ObstacleTexture
}

// ─── Layout result (computed, not stored) ──────────────────────────────────
export interface FrameRect extends Rect {
  frameIndex: number
}

// ─── Budget (computed, not stored) ─────────────────────────────────────────
export interface BudgetResult {
  lines: BudgetLine[]
  rosetteLines: RosetteBudgetLine[]
  totalCost: number
}

export interface BudgetLine {
  moldingId: string
  moldingName: string
  linearMeters: number   // ml avant chute
  wasteFactor: number    // 1.15 cadres, 1.0 rail — affichage seul
  barsNeeded: number
  costPerBar: number
  totalCost: number
}

export interface RosetteBudgetLine {
  rosetteId: string
  rosetteName: string
  count: number
  pricePerPiece: number
  totalCost: number
}

// ─── App state ─────────────────────────────────────────────────────────────
export interface AppState {
  project: Project
  geminiApiKey: string
  geminiModel: 'gemini-flash' | 'imagen-4'
  geminiLastImage?: string // base64 PNG
}
