# Moldures Designer — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page TypeScript web app for planning and budgeting decorative wall moldings, deployable to GitHub Pages.

**Architecture:** Vite + TypeScript vanilla, Canvas 2D for rendering, modular services for layout/budget/PDF/Gemini. A central `AppState` object drives all rendering and UI via a unidirectional data flow: user action → mutate state → render canvas + update budget.

**Tech Stack:** Vite 7, TypeScript 5, Canvas 2D API, jsPDF + jspdf-autotable, @google/genai, localStorage

---

## Chunk 1: Project Setup

### Task 1: Initialize Vite + TypeScript project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `.github/workflows/deploy.yml`
- Create: `.gitignore`

- [ ] **Step 1: Init project**

```bash
cd D:/Projets/Moldures
npm create vite@latest . -- --template vanilla-ts
```

Expected output: project files created in current directory.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install jspdf jspdf-autotable @google/genai immer zod color2k nanoid lit-html
npm install -D vitest @vitest/ui jsdom tailwindcss @tailwindcss/vite
```

> **Pourquoi ces libs :**
> - `zod` — validation runtime du JSON chargé (remplace le spread dangereux dans validateAndMigrate)
> - `color2k` — lighten/darken couleurs (remplace colorUtils.ts custom, 1.7KB)
> - `nanoid` — IDs URL-safe (remplace `crypto.randomUUID()` incompatible jsdom)
> - `lit-html` — tagged templates sécurisés pour les panels (escaping auto, events inline)

- [ ] **Step 3: Configure vite.config.ts**

Replace the generated `vite.config.ts` with:

```typescript
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/moldures-designer/',
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],  // polyfill crypto.randomUUID pour nanoid
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3b: Create src/test-setup.ts**

```typescript
// src/test-setup.ts — polyfill utilisé uniquement en test (jsdom ne fournit pas crypto complet)
import { vi } from 'vitest'
if (typeof crypto === 'undefined' || !crypto.randomUUID) {
  let counter = 0
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `test-uuid-${++counter}` },
  })
}
```

- [ ] **Step 3c: Create src/utils/h.ts**

```typescript
// src/utils/h.ts — escape HTML pour les rares cas d'innerHTML restants (modals)
const MAP: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}
export const h = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, c => MAP[c]!)
```

- [ ] **Step 4: Configure tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "./dist",
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Update package.json scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",  // --noEmit : type-check seulement, vite fait le vrai build
    "preview": "vite preview",
    "test": "vitest run",
    "test:ui": "vitest --ui"
  }
}
```

- [ ] **Step 6: Create GitHub Actions workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: ['main']
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: 'pages'
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 7: Create src folder structure**

```bash
mkdir -p src/types src/state src/renderer src/ui src/services src/utils
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: server running at `http://localhost:5173/moldures-designer/`

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "chore: init Vite TypeScript project with GitHub Actions deploy"
```

---

## Chunk 2: Types & State

### Task 2: TypeScript types

**Files:**
- Create: `src/types/index.ts`
- Create: `src/types/schemas.ts`

- [ ] **Step 1: Write all types**

Create `src/types/index.ts`:

```typescript
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
```

- [ ] **Step 2: Write schemas.ts (zod — validation JSON chargé)**

Create `src/types/schemas.ts`:

```typescript
import { z } from 'zod'

const ZoneLayoutSchema = z.object({
  frameCount:       z.number().int().min(0).max(20),
  marginTop:        z.number().min(0),
  marginBottom:     z.number().min(0),
  marginLeft:       z.number().min(0),
  marginRight:      z.number().min(0),
  gapBetweenFrames: z.number().min(0),
  customWidths:     z.array(z.number().min(0)),
  customHeights:    z.array(z.number().min(0)),
})

const NestedLevelSchema = z.object({
  offset:      z.number().min(0),
  moldingId:   z.string(),
  cornerStyle: z.enum(['miter', 'rosette']),
  rosetteId:   z.string().optional(),
})

const FrameSchema = z.object({
  id:           z.string(),
  moldingId:    z.string(),
  cornerStyle:  z.enum(['miter', 'rosette']),
  rosetteId:    z.string().optional(),
  nestedLevels: z.array(NestedLevelSchema),
})

const ZoneSchema = z.object({
  id:     z.string(),
  type:   z.enum(['top', 'bottom', 'full']),
  layout: ZoneLayoutSchema,
  frames: z.array(FrameSchema),
})

const ObstacleSchema = z.object({
  id:        z.string(),
  name:      z.string().max(100),
  type:      z.enum(['window', 'door', 'radiator', 'outlet', 'switch', 'fireplace', 'custom']),
  width:     z.number().min(1),
  height:    z.number().min(1),
  positionX: z.number().min(0),
  positionY: z.number().min(0),
  display:   z.object({
    transparent: z.boolean(),
    fillColor:   z.string().optional(),
    texture:     z.enum(['wood', 'glass', 'brick', 'metal']).optional(),
  }),
})

const WallSchema = z.object({
  id:                  z.string(),
  name:                z.string().max(100),
  dimensions:          z.object({ width: z.number().min(1), height: z.number().min(1), plinthHeight: z.number().min(0) }),
  zoneMode:            z.enum(['1zone', '2zones']),
  zones:               z.array(ZoneSchema),
  separator:           z.object({ positionPercent: z.number().min(0).max(100), visible: z.boolean(), moldingId: z.string() }).optional(),
  archivedBottomZone:  ZoneSchema.optional(),
  obstacles:           z.array(ObstacleSchema),
  colors:              z.object({ wall: z.string(), moldings: z.string(), plinth: z.string() }),
  showAnnotations:     z.boolean(),
})

const MoldingSchema = z.object({
  id:            z.string(),
  name:          z.string().max(100),
  reference:     z.string().max(50),
  width:         z.number().min(1).max(500),
  thickness:     z.number().min(1).max(500),
  barLength:     z.number().min(1),
  pricePerBar:   z.number().min(0),
  color:         z.string(),
})

const RosetteSchema = z.object({
  id:            z.string(),
  name:          z.string().max(100),
  reference:     z.string().max(50),
  size:          z.number().min(1),
  pricePerPiece: z.number().min(0),
})

export const ProjectSchema = z.object({
  id:            z.string(),
  version:       z.number().int().default(1),
  name:          z.string().max(200),
  createdAt:     z.string(),
  activeWallId:  z.string(),
  walls:         z.array(WallSchema).min(1),
  moldings:      z.array(MoldingSchema),
  rosettes:      z.array(RosetteSchema),
})

export type ProjectFromSchema = z.infer<typeof ProjectSchema>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/types/schemas.ts
git commit -m "feat: add complete TypeScript types and zod validation schemas"
```

---

### Task 3: Defaults & AppState

**Files:**
- Create: `src/state/defaults.ts`
- Create: `src/state/AppState.ts` — inclut undo/redo (snapshots, max 50)

- [ ] **Step 1: Write defaults.ts**

Create `src/state/defaults.ts`:

```typescript
import { nanoid } from 'nanoid'
import type { Project, Zone, ZoneLayout, Molding } from '../types/index.js'

export function makeDefaultZoneLayout(frameCount = 2): ZoneLayout {
  return {
    frameCount,
    marginTop: 15,
    marginBottom: 15,
    marginLeft: 20,
    marginRight: 20,
    gapBetweenFrames: 10,
    customWidths: Array(frameCount).fill(0),
    customHeights: Array(frameCount).fill(0),
  }
}

// makeDefaultZone : pour créer de nouvelles zones dynamiquement (IDs aléatoires)
export function makeDefaultZone(type: Zone['type'] = 'full', frameCount = 2): Zone {
  const layout = makeDefaultZoneLayout(frameCount)
  return {
    id: nanoid(),
    type,
    layout,
    frames: Array.from({ length: frameCount }, () => ({
      id: nanoid(),
      moldingId: 'm1',
      cornerStyle: 'miter' as const,
      nestedLevels: [],
    })),
  }
}

export const DEFAULT_MOLDING: Molding = {
  id: 'm1',
  name: 'Pin PEFC 16×29mm',
  reference: 'PIN-16-29-270',
  width: 16,
  thickness: 29,
  barLength: 270,
  pricePerBar: 4.50,
  color: '#e8d5b0',
}

// makeDefaultProject : IDs fixes pour reproductibilité (premier démarrage + tests)
export function makeDefaultProject(): Project {
  return {
    id: 'proj-default',
    version: 1,
    name: 'Mon projet',
    createdAt: new Date().toISOString(),
    activeWallId: 'wall-1',
    moldings: [{ ...DEFAULT_MOLDING }],
    rosettes: [],
    walls: [{
      id: 'wall-1',
      name: 'Mur principal',
      dimensions: { width: 400, height: 250, plinthHeight: 10 },
      zoneMode: '1zone',
      zones: [{
        id: 'zone-1',
        type: 'full',
        layout: makeDefaultZoneLayout(2),
        frames: [
          { id: nanoid(), moldingId: 'm1', cornerStyle: 'miter', nestedLevels: [] },
          { id: nanoid(), moldingId: 'm1', cornerStyle: 'miter', nestedLevels: [] },
        ],
      }],
      obstacles: [],
      colors: { wall: '#f5f0e8', moldings: '', plinth: '#ffffff' },
      showAnnotations: true,
    }],
  }
}
```

- [ ] **Step 2: Write AppState.ts**

Create `src/state/AppState.ts`:

```typescript
import type { AppState, Project } from '../types/index.js'
import { makeDefaultProject } from './defaults.js'

let _state: AppState = {
  project: makeDefaultProject(),
  geminiApiKey: '',
  geminiModel: 'gemini-flash',
}

// ── History (undo/redo) ───────────────────────────────────────────────────────
const MAX_HISTORY = 50
let _past:   AppState[] = []
let _future: AppState[] = []

type Listener = () => void
const listeners = new Set<Listener>()

export function getState(): AppState {
  return _state
}

export function getProject(): Project {
  return _state.project
}

export function getActiveWall() {
  const p = _state.project
  return p.walls.find(w => w.id === p.activeWallId) ?? p.walls[0]
}

export function setState(updater: (draft: AppState) => AppState): void {
  _past = [..._past.slice(-(MAX_HISTORY - 1)), structuredClone(_state)]
  _future = []
  _state = updater(_state)
  notify()
}

export function undo(): void {
  if (!_past.length) return
  _future = [structuredClone(_state), ..._future.slice(0, MAX_HISTORY - 1)]
  _state = _past.pop()!
  notify()
}

export function redo(): void {
  if (!_future.length) return
  _past = [..._past.slice(-(MAX_HISTORY - 1)), structuredClone(_state)]
  _state = _future.shift()!
  notify()
}

export function canUndo(): boolean { return _past.length > 0 }
export function canRedo(): boolean { return _future.length > 0 }

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify(): void {
  listeners.forEach(fn => fn())
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/state/
git commit -m "feat: add AppState singleton, project defaults and undo/redo history"
```

---

### Task 4: Storage (localStorage + JSON migration) + Toast

**Files:**
- Create: `src/state/storage.ts`
- Create: `src/state/storage.test.ts`
- Create: `src/ui/toast.ts`

- [ ] **Step 1: Write failing tests**

Create `src/state/storage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateAndMigrate, toDateString } from './storage.js'

describe('validateAndMigrate', () => {
  it('rejects null', () => {
    expect(() => validateAndMigrate(null)).toThrow('Invalid project file')
  })

  it('rejects non-object', () => {
    expect(() => validateAndMigrate('string')).toThrow('Invalid project file')
  })

  it('rejects project with missing required fields', () => {
    expect(() => validateAndMigrate({ id: 'x', name: 'Test' })).toThrow('Invalid project file')
  })

  it('accepts valid v1 project and returns version 1', () => {
    const raw = {
      id: 'abc', version: 1, name: 'Test', createdAt: '2026-01-01',
      activeWallId: 'w1', moldings: [], rosettes: [],
      walls: [{
        id: 'w1', name: 'Mur', dimensions: { width: 300, height: 250, plinthHeight: 10 },
        zoneMode: '1zone', zones: [], obstacles: [],
        colors: { wall: '#fff', moldings: '', plinth: '#fff' },
        showAnnotations: true,
      }],
    }
    const result = validateAndMigrate(raw)
    expect(result.version).toBe(1)
    expect(result.name).toBe('Test')
  })

  it('fills missing version with 1', () => {
    const raw = {
      id: 'abc', name: 'Test', createdAt: '2026-01-01',
      activeWallId: 'w1', moldings: [], rosettes: [],
      walls: [],
    }
    const result = validateAndMigrate(raw)
    expect(result.version).toBe(1)
  })
})

describe('toDateString', () => {
  it('formats date as YYYY-MM-DD', () => {
    const d = new Date('2026-03-18T12:00:00Z')
    expect(toDateString(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Run failing tests**

```bash
npm test
```

Expected: FAIL — `validateAndMigrate` not found.

- [ ] **Step 3: Write storage.ts**

Create `src/state/storage.ts`:

```typescript
import type { Project } from '../types/index.js'
import { ProjectSchema } from '../types/schemas.js'
import { makeDefaultProject } from './defaults.js'
import { showToast } from '../ui/toast.js'

const STORAGE_KEY = 'moldures_project'
const GEMINI_KEY  = 'moldures_gemini_key'

// ─── Persistence ───────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function autoSave(project: Project): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    showToast('✓ Sauvegardé')
  }, 500)
}

export function loadProject(): { project: Project; restored: boolean } {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { project: makeDefaultProject(), restored: false }
  try {
    const parsed = JSON.parse(raw) as unknown
    return { project: validateAndMigrate(parsed), restored: true }
  } catch {
    console.warn('Failed to restore project, using defaults')
    return { project: makeDefaultProject(), restored: false }
  }
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// ─── Gemini key ─────────────────────────────────────────────────────────────

export function saveGeminiKey(key: string): void {
  localStorage.setItem(GEMINI_KEY, key)
}

export function loadGeminiKey(): string {
  return localStorage.getItem(GEMINI_KEY) ?? ''
}

// ─── Export / Import ────────────────────────────────────────────────────────

export function exportProject(project: Project): void {
  const blob = new Blob(
    [JSON.stringify(project, null, 2)],
    { type: 'application/json' }
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name}-${toDateString(new Date())}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importProject(file: File): Promise<Project> {
  const text = await file.text()
  const raw = JSON.parse(text) as unknown
  return validateAndMigrate(raw)
}

// ─── Migration ──────────────────────────────────────────────────────────────

export function validateAndMigrate(raw: unknown): Project {
  // zod valide le schéma complet et retourne des types corrects
  // safeParse ne lève pas d'exception — on gère l'erreur explicitement
  const result = ProjectSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`Invalid project file: ${result.error.issues[0]?.message ?? 'schema error'}`)
  }
  // Future migrations: if (result.data.version < 2) { ... migrate fields ... }
  return result.data as Project
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// showToast vit dans src/ui/toast.ts — importé ci-dessus
```

- [ ] **Step 4: Write toast.ts**

Create `src/ui/toast.ts`:

```typescript
let toastTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  const el = document.getElementById('app-toast')
  if (!el) return
  el.textContent = message
  el.className = `app-toast app-toast--${type} app-toast--visible`
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    el.classList.remove('app-toast--visible')
  }, 2500)
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npm test
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/state/storage.ts src/state/storage.test.ts src/ui/toast.ts
git commit -m "feat: add localStorage persistence, JSON migration, and toast utility"
```

---

## Chunk 3: Layout Engine & Budget

### Task 5: Layout engine (services/layout.ts)

**Files:**
- Create: `src/services/layout.ts`
- Create: `src/services/layout.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/services/layout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeFrameLayout, computeNestedRect, computeZoneRect } from './layout.js'
import type { Zone, Wall, Rect } from '../types/index.js'

function makeZone(overrides: Partial<Zone['layout']> = {}): Zone {
  return {
    id: 'z1', type: 'full',
    layout: {
      frameCount: 2,
      marginTop: 10, marginBottom: 10,
      marginLeft: 10, marginRight: 10,
      gapBetweenFrames: 5,
      customWidths: [0, 0],
      customHeights: [0, 0],
      ...overrides,
    },
    frames: [],
  }
}

describe('computeFrameLayout', () => {
  it('divides available width equally for 2 auto frames', () => {
    const zone = makeZone()
    const zoneRect: Rect = { x: 0, y: 0, width: 200, height: 100 }
    const rects = computeFrameLayout(zone, zoneRect)
    // availableWidth = 200 - 10 - 10 = 180, gap = 5, 2 frames → each = (180-5)/2 = 87.5
    expect(rects).toHaveLength(2)
    expect(rects[0]!.width).toBeCloseTo(87.5)
    expect(rects[1]!.width).toBeCloseTo(87.5)
  })

  it('positions frames sequentially with gap', () => {
    const zone = makeZone()
    const zoneRect: Rect = { x: 0, y: 0, width: 200, height: 100 }
    const rects = computeFrameLayout(zone, zoneRect)
    expect(rects[0]!.x).toBeCloseTo(10) // marginLeft
    expect(rects[1]!.x).toBeCloseTo(10 + 87.5 + 5) // marginLeft + w0 + gap
  })

  it('respects custom widths and uses auto for remaining', () => {
    const zone = makeZone({ frameCount: 3, customWidths: [60, 0, 0], customHeights: [0, 0, 0] })
    const zoneRect: Rect = { x: 0, y: 0, width: 200, height: 100 }
    const rects = computeFrameLayout(zone, zoneRect)
    // availableWidth=180, fixedWidths=60, gaps=2×5=10, autoWidth=(180-10-60)/2=55
    expect(rects[0]!.width).toBe(60)
    expect(rects[1]!.width).toBeCloseTo(55)
    expect(rects[2]!.width).toBeCloseTo(55)
  })

  it('uses full available height when customHeight is 0', () => {
    const zone = makeZone()
    const zoneRect: Rect = { x: 0, y: 0, width: 200, height: 100 }
    const rects = computeFrameLayout(zone, zoneRect)
    // availableHeight = 100 - 10 - 10 = 80
    expect(rects[0]!.height).toBe(80)
  })

  it('handles out-of-bounds customWidths index as 0', () => {
    const zone = makeZone({ frameCount: 3, customWidths: [0, 0], customHeights: [0, 0] })
    const zoneRect: Rect = { x: 0, y: 0, width: 200, height: 100 }
    const rects = computeFrameLayout(zone, zoneRect)
    expect(rects).toHaveLength(3)
    // no crash, all auto
    expect(rects[2]!.width).toBeGreaterThan(0)
  })
})

describe('computeNestedRect', () => {
  it('reduces rect by cumulative offset on all sides', () => {
    const parent: Rect = { x: 10, y: 10, width: 100, height: 80 }
    const nested = computeNestedRect(parent, 5)
    expect(nested).toEqual({ x: 15, y: 15, width: 90, height: 70 })
  })

  it('returns zero-width rect when offset exceeds half-width', () => {
    const parent: Rect = { x: 0, y: 0, width: 10, height: 20 }
    const nested = computeNestedRect(parent, 8)
    expect(nested.width).toBeLessThanOrEqual(0)
  })
})

describe('computeZoneRect', () => {
  const wall: Wall = {
    id: 'w1', name: 'Mur',
    dimensions: { width: 400, height: 250, plinthHeight: 10 },
    zoneMode: '2zones',
    zones: [],
    separator: { positionPercent: 60, visible: true, moldingId: 'm1' },
    obstacles: [],
    colors: { wall: '#fff', moldings: '', plinth: '#fff' },
    showAnnotations: false,
  }

  it('computes full zone rect in 1-zone mode', () => {
    const w1 = { ...wall, zoneMode: '1zone' as const, separator: undefined }
    const rect = computeZoneRect(w1, 'full')
    // usableHeight = 250 - 10 = 240
    expect(rect.height).toBe(240)
    expect(rect.y).toBe(0)
  })

  it('computes top zone at 60% separator', () => {
    const rect = computeZoneRect(wall, 'top')
    // usableHeight=240, separatorY = 240 * 0.60 = 144
    expect(rect.height).toBeCloseTo(144)
    expect(rect.y).toBe(0)
  })

  it('computes bottom zone below separator', () => {
    const rect = computeZoneRect(wall, 'bottom')
    // usableHeight=240, separatorY=144, bottomHeight=240-144=96
    expect(rect.height).toBeCloseTo(96)
    expect(rect.y).toBeCloseTo(144)
  })
})
```

- [ ] **Step 2: Run failing tests**

```bash
npm test
```

Expected: FAIL — `computeFrameLayout` not found.

- [ ] **Step 3: Implement layout.ts**

Create `src/services/layout.ts`:

```typescript
import type { Zone, Wall, Rect, FrameRect } from '../types/index.js'

/**
 * Computes the canvas rectangle (in cm) for a zone on the wall.
 * Y=0 is the top of the drawable area (just above the plinth).
 */
export function computeZoneRect(wall: Wall, zoneType: Zone['type']): Rect {
  const usableHeight = wall.dimensions.height - wall.dimensions.plinthHeight

  if (zoneType === 'full' || !wall.separator) {
    return { x: 0, y: 0, width: wall.dimensions.width, height: usableHeight }
  }

  const separatorY = usableHeight * (wall.separator.positionPercent / 100)

  if (zoneType === 'top') {
    return { x: 0, y: 0, width: wall.dimensions.width, height: separatorY }
  }

  // bottom
  return {
    x: 0,
    y: separatorY,
    width: wall.dimensions.width,
    height: usableHeight - separatorY,
  }
}

/**
 * Computes frame positions and sizes (in cm) within a zone.
 * This is the single source of truth used by both the renderer and budget.
 */
export function computeFrameLayout(zone: Zone, zoneRect: Rect): FrameRect[] {
  const { layout } = zone
  const availableWidth  = zoneRect.width  - layout.marginLeft - layout.marginRight
  const availableHeight = zoneRect.height - layout.marginTop  - layout.marginBottom
  const totalGapWidth   = Math.max(0, layout.frameCount - 1) * layout.gapBetweenFrames

  // Un seul reduce au lieu de deux filter/reduce successifs — O(n) unique
  const { fixedWidths, autoCount } = layout.customWidths
    .slice(0, layout.frameCount)
    .reduce(
      (acc, w) => w > 0
        ? { fixedWidths: acc.fixedWidths + w, autoCount: acc.autoCount }
        : { fixedWidths: acc.fixedWidths,     autoCount: acc.autoCount + 1 },
      { fixedWidths: 0, autoCount: 0 },
    )

  const autoWidth = autoCount > 0
    ? (availableWidth - totalGapWidth - fixedWidths) / autoCount
    : 0

  let currentX = zoneRect.x + layout.marginLeft

  return Array.from({ length: layout.frameCount }, (_, i) => {
    const customW = layout.customWidths[i]  ?? 0
    const customH = layout.customHeights[i] ?? 0
    const frameWidth  = customW > 0 ? customW : autoWidth
    const frameHeight = customH > 0 ? customH : availableHeight
    const frameY = zoneRect.y + layout.marginTop + (availableHeight - frameHeight) / 2

    const rect: FrameRect = {
      frameIndex: i,
      x: currentX,
      y: frameY,
      width: frameWidth,
      height: frameHeight,
    }
    currentX += frameWidth + layout.gapBetweenFrames
    return rect
  })
}

/**
 * Computes the rectangle of a nested frame level.
 * cumulativeOffset is the total inset from the outermost frame border.
 */
export function computeNestedRect(parentRect: Rect, cumulativeOffset: number): Rect {
  return {
    x: parentRect.x + cumulativeOffset,
    y: parentRect.y + cumulativeOffset,
    width:  parentRect.width  - 2 * cumulativeOffset,
    height: parentRect.height - 2 * cumulativeOffset,
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```

Expected: all layout tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/layout.ts src/services/layout.test.ts
git commit -m "feat: add layout engine with frame placement and zone rect computation"
```

---

### Task 6: Budget calculator (services/budget.ts)

**Files:**
- Create: `src/services/budget.ts`
- Create: `src/services/budget.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/services/budget.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeBudget } from './budget.js'
import type { Project, Wall } from '../types/index.js'

function makeProject(): Project {
  return {
    id: 'p1', version: 1, name: 'Test', createdAt: '2026-01-01',
    activeWallId: 'w1',
    moldings: [{
      id: 'm1', name: 'Pin', reference: 'X', width: 16, thickness: 29,
      barLength: 270, pricePerBar: 4.50, color: '#fff',
    }],
    rosettes: [],
    walls: [],
  }
}

function makeWall(width = 200, height = 100, plinth = 10): Wall {
  return {
    id: 'w1', name: 'Mur',
    dimensions: { width, height, plinthHeight: plinth },
    zoneMode: '1zone',
    zones: [{
      id: 'z1', type: 'full',
      layout: {
        frameCount: 1,
        marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5,
        gapBetweenFrames: 0,
        customWidths: [0], customHeights: [0],
      },
      frames: [{ id: 'f1', moldingId: 'm1', cornerStyle: 'miter', nestedLevels: [] }],
    }],
    obstacles: [], separator: undefined,
    colors: { wall: '#fff', moldings: '', plinth: '#fff' },
    showAnnotations: false,
  }
}

describe('computeBudget', () => {
  it('calculates linear meters for a single frame', () => {
    const project = makeProject()
    const wall = makeWall(200, 100, 10)
    // zoneRect: {x:0,y:0,w:200,h:90}, frameRect: {x:5,y:5,w:190,h:80}
    // perimeter = 2*(190+80) = 540 cm = 5.4 m
    const budget = computeBudget(project, wall)
    expect(budget.lines).toHaveLength(1)
    expect(budget.lines[0]!.linearMeters).toBeCloseTo(5.4)
  })

  it('applies 15% waste factor for frames', () => {
    const project = makeProject()
    const wall = makeWall(200, 100, 10)
    const budget = computeBudget(project, wall)
    // 5.4m * 1.15 = 6.21m, barLength=270cm=2.7m → ceil(6.21/2.7) = ceil(2.3) = 3 bars
    expect(budget.lines[0]!.wasteFactor).toBe(1.15)
    expect(budget.lines[0]!.barsNeeded).toBe(3)
  })

  it('calculates cost correctly', () => {
    const project = makeProject()
    const wall = makeWall(200, 100, 10)
    const budget = computeBudget(project, wall)
    expect(budget.lines[0]!.totalCost).toBeCloseTo(3 * 4.50)
  })

  it('adds separator without waste factor', () => {
    const project = makeProject()
    const wall: Wall = {
      ...makeWall(270, 100, 10),
      separator: { positionPercent: 50, visible: true, moldingId: 'm1' },
      zoneMode: '2zones',
      zones: [
        { id: 'z1', type: 'top', layout: { frameCount: 0, marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5, gapBetweenFrames: 0, customWidths: [], customHeights: [] }, frames: [] },
        { id: 'z2', type: 'bottom', layout: { frameCount: 0, marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5, gapBetweenFrames: 0, customWidths: [], customHeights: [] }, frames: [] },
      ],
    }
    const budget = computeBudget(project, wall)
    const railLine = budget.lines.find(l => l.wasteFactor === 1.0)
    expect(railLine).toBeDefined()
    // wall width = 270cm = 2.7m, barLength = 270cm = 2.7m → 1 bar
    expect(railLine!.barsNeeded).toBe(1)
  })

  it('counts 4 rosettes per frame with rosette corner style', () => {
    const project: Project = {
      ...makeProject(),
      rosettes: [{ id: 'r1', name: 'Rosette', reference: 'R1', size: 5, pricePerPiece: 2 }],
    }
    const wall: Wall = {
      ...makeWall(),
      zones: [{
        id: 'z1', type: 'full',
        layout: { frameCount: 2, marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5, gapBetweenFrames: 5, customWidths: [0, 0], customHeights: [0, 0] },
        frames: [
          { id: 'f1', moldingId: 'm1', cornerStyle: 'rosette', rosetteId: 'r1', nestedLevels: [] },
          { id: 'f2', moldingId: 'm1', cornerStyle: 'rosette', rosetteId: 'r1', nestedLevels: [] },
        ],
      }],
    }
    const budget = computeBudget(project, wall)
    expect(budget.rosetteLines).toHaveLength(1)
    expect(budget.rosetteLines[0]!.count).toBe(8) // 4 × 2 frames
    expect(budget.rosetteLines[0]!.totalCost).toBeCloseTo(16) // 8 × 2€
  })

  it('returns zero cost for empty wall', () => {
    const project = makeProject()
    const wall: Wall = {
      ...makeWall(),
      zones: [{ id: 'z1', type: 'full', layout: { frameCount: 0, marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5, gapBetweenFrames: 0, customWidths: [], customHeights: [] }, frames: [] }],
    }
    const budget = computeBudget(project, wall)
    expect(budget.totalCost).toBe(0)
    expect(budget.lines).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run failing tests**

```bash
npm test
```

Expected: FAIL — `computeBudget` not found.

- [ ] **Step 3: Implement budget.ts**

Create `src/services/budget.ts`:

```typescript
import type { Project, Wall, Zone, Frame, BudgetResult, BudgetLine, RosetteBudgetLine, Rect } from '../types/index.js'
import { computeFrameLayout, computeZoneRect, computeNestedRect } from './layout.js'

export function computeBudget(project: Project, wall: Wall): BudgetResult {
  // Index upfront — O(1) lookup au lieu de find() O(n) dans les boucles
  const moldingMap = new Map(project.moldings.map(m => [m.id, m]))
  const rosetteMap = new Map(project.rosettes.map(r => [r.id, r]))

  // Accumulators
  const linearMeters: Record<string, number> = {}
  const rosetteCount: Record<string, number> = {}

  // Process frames in each zone
  for (const zone of wall.zones) {
    const zoneRect = computeZoneRect(wall, zone.type)
    if (zone.frames.length === 0) continue
    const frameRects = computeFrameLayout(zone, zoneRect)

    for (let i = 0; i < zone.frames.length; i++) {
      const frame = zone.frames[i]!
      const rect  = frameRects[i]!
      accumulateFrame(project, frame, rect, linearMeters, rosetteCount, moldingMap, rosetteMap)
    }
  }

  // Separator rail (no waste)
  const railData: { moldingId: string; meters: number } | null =
    wall.separator?.visible
      ? { moldingId: wall.separator.moldingId, meters: wall.dimensions.width / 100 }
      : null

  // Build budget lines for moldings
  const lines: BudgetLine[] = []
  const allMoldingIds = new Set([
    ...Object.keys(linearMeters),
    ...(railData ? [railData.moldingId] : []),
  ])

  for (const moldingId of allMoldingIds) {
    const molding = moldingMap.get(moldingId)
    if (!molding) continue

    const frameMeters = linearMeters[moldingId] ?? 0
    const railMeters  = railData?.moldingId === moldingId ? railData.meters : 0

    // Frame portion: +15% waste
    const frameWastedMeters = frameMeters * 1.15
    // Rail portion: no waste
    const totalMeters = frameWastedMeters + railMeters

    if (totalMeters === 0) continue

    const barLengthM = molding.barLength / 100
    const barsNeeded = Math.ceil(totalMeters / barLengthM)

    // Determine waste factor for display (1.15 if frames only, 1.0 if rail only)
    const wasteFactor = frameMeters > 0 ? 1.15 : 1.0

    lines.push({
      moldingId,
      moldingName: molding.name,
      linearMeters: frameMeters + railMeters,
      wasteFactor,
      barsNeeded,
      costPerBar: molding.pricePerBar,
      totalCost: barsNeeded * molding.pricePerBar,
    })
  }

  // Build rosette lines
  const rosetteLines: RosetteBudgetLine[] = Object.entries(rosetteCount)
    .map(([rosetteId, count]) => {
      const rosette = rosetteMap.get(rosetteId)
      if (!rosette) return null
      return {
        rosetteId,
        rosetteName: rosette.name,
        count,
        pricePerPiece: rosette.pricePerPiece,
        totalCost: count * rosette.pricePerPiece,
      }
    })
    .filter(Boolean) as RosetteBudgetLine[]

  const totalCost =
    lines.reduce((s, l) => s + l.totalCost, 0) +
    rosetteLines.reduce((s, r) => s + r.totalCost, 0)

  return { lines, rosetteLines, totalCost }
}

function accumulateFrame(
  project: Project,
  frame: Frame,
  rect: Rect,
  linearMeters: Record<string, number>,
  rosetteCount: Record<string, number>,
  moldingMap: Map<string, import('../types/index.js').Molding>,
  rosetteMap: Map<string, import('../types/index.js').Rosette>,
): void {
  addPerimeter(frame.moldingId, rect, frame.cornerStyle, frame.rosetteId, linearMeters, rosetteCount, rosetteMap)

  // Nested levels: cumulative offset from outer frame border
  let cumulOffset = 0
  for (const level of frame.nestedLevels) {
    const parentMolding = moldingMap.get(frame.moldingId)
    cumulOffset += level.offset + (parentMolding ? parentMolding.width / 10 : 0) // mm→cm
    const nestedRect = computeNestedRect(rect, cumulOffset)
    if (nestedRect.width <= 0 || nestedRect.height <= 0) break
    addPerimeter(level.moldingId, nestedRect, level.cornerStyle, level.rosetteId, linearMeters, rosetteCount, rosetteMap)
  }
}

function addPerimeter(
  moldingId: string,
  rect: Rect,
  cornerStyle: 'miter' | 'rosette',
  rosetteId: string | undefined,
  linearMeters: Record<string, number>,
  rosetteCount: Record<string, number>,
  rosetteMap: Map<string, import('../types/index.js').Rosette>,
): void {
  let meters: number

  if (cornerStyle === 'rosette' && rosetteId) {
    const rosette = rosetteMap.get(rosetteId)
    if (rosette) {
      const straightW = rect.width  - 2 * rosette.size
      const straightH = rect.height - 2 * rosette.size
      meters = (2 * (Math.max(0, straightW) + Math.max(0, straightH))) / 100
      rosetteCount[rosetteId] = (rosetteCount[rosetteId] ?? 0) + 4
    } else {
      meters = 2 * (rect.width + rect.height) / 100
    }
  } else {
    meters = 2 * (rect.width + rect.height) / 100
  }

  linearMeters[moldingId] = (linearMeters[moldingId] ?? 0) + meters
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```

Expected: all budget tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/budget.ts src/services/budget.test.ts
git commit -m "feat: add budget calculator with waste factor and rosette support"
```

---

## Chunk 4: Canvas Renderer

### Task 7: Canvas scale + Renderer skeleton

**Files:**
- Create: `src/renderer/scale.ts`
- Create: `src/renderer/Renderer.ts` — inclut zoom wheel (camera locale, non-sauvegardée)

- [ ] **Step 1: Write scale.ts**

Create `src/renderer/scale.ts`:

```typescript
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
```

- [ ] **Step 2: Create Renderer.ts skeleton**

Create `src/renderer/Renderer.ts`:

```typescript
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
```

- [ ] **Step 3: Commit skeleton**

```bash
git add src/renderer/scale.ts src/renderer/Renderer.ts
git commit -m "feat: add canvas renderer with HiDPI support, zoom wheel and camera state"
```

---

### Task 8: drawWall + drawObstacles

> `colorUtils.ts` supprimé — remplacé par `color2k` (1.7KB, tree-shakeable).
> `lighten(hex, 0.15)` et `darken(hex, 0.15)` de color2k acceptent des ratios 0–1.
> Conversion depuis les anciens `amount` 0–255 : `amount / 255`.

**Files:**
- Create: `src/renderer/drawWall.ts`
- Create: `src/renderer/drawObstacles.ts`

- [ ] **Step 1: Write drawWall.ts**

Create `src/renderer/drawWall.ts`:

```typescript
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
```

- [ ] **Step 2: Write drawObstacles.ts**

Create `src/renderer/drawObstacles.ts`:

```typescript
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
  const { width: ww, height: wh } = wall.dimensions

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
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/colorUtils.ts src/renderer/drawWall.ts src/renderer/drawObstacles.ts
git commit -m "feat: add colorUtils, render wall background, plinth and obstacles"
```

---

### Task 9: drawFrames (bevel effect)

**Files:**
- Create: `src/renderer/drawFrames.ts`

- [ ] **Step 1: Write drawFrames.ts**

Create `src/renderer/drawFrames.ts`:

```typescript
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

// lighten / darken imported from colorUtils.ts
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/drawFrames.ts
git commit -m "feat: render beveled frames with nested levels and collision highlight"
```

---

### Task 10: drawAnnotations

**Files:**
- Create: `src/renderer/drawAnnotations.ts`

- [ ] **Step 1: Write drawAnnotations.ts**

Create `src/renderer/drawAnnotations.ts`:

```typescript
import type { RenderContext } from './Renderer.js'
import { cm } from './scale.js'
import { computeFrameLayout, computeZoneRect } from '../services/layout.js'

export function drawAnnotations(rc: RenderContext): void {
  const { ctx, scale, ox, oy, wall } = rc
  ctx.fillStyle = '#222222'
  ctx.strokeStyle = '#444444'

  const fontSize = Math.max(9, Math.min(13, cm(4, scale)))
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.lineWidth = 0.5

  // Wall width annotation (top)
  drawDimensionLine(rc, ox, oy - 20, ox + cm(wall.dimensions.width, scale), oy - 20,
    `${wall.dimensions.width} cm`)

  // Wall height annotation (right)
  drawVerticalDimension(rc, ox + cm(wall.dimensions.width, scale) + 20, oy,
    ox + cm(wall.dimensions.width, scale) + 20, oy + cm(wall.dimensions.height, scale),
    `${wall.dimensions.height} cm`)

  // Frame annotations
  for (const zone of wall.zones) {
    const zoneRect = computeZoneRect(wall, zone.type)
    if (zone.frames.length === 0) continue
    const frameRects = computeFrameLayout(zone, zoneRect)
    for (const rect of frameRects) {
      const px = ox + cm(rect.x, scale)
      const py = oy + cm(rect.y, scale)
      const pw = cm(rect.width, scale)
      const ph = cm(rect.height, scale)
      // Frame width
      ctx.fillStyle = '#333'
      ctx.textAlign = 'center'
      ctx.fillText(`${Math.round(rect.width)} cm`, px + pw / 2, py - 6)
      // Frame height (rotated)
      ctx.save()
      ctx.translate(px - 6, py + ph / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(`${Math.round(rect.height)} cm`, 0, 0)
      ctx.restore()
    }
  }
}

function drawDimensionLine(
  rc: RenderContext,
  x1: number, y1: number,
  x2: number, y2: number,
  label: string
): void {
  const { ctx } = rc
  ctx.strokeStyle = '#666'
  ctx.lineWidth = 0.8
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#333'
  ctx.textAlign = 'center'
  ctx.fillText(label, (x1 + x2) / 2, y1 - 4)
}

function drawVerticalDimension(
  rc: RenderContext,
  x1: number, y1: number,
  x2: number, y2: number,
  label: string
): void {
  const { ctx } = rc
  ctx.strokeStyle = '#666'
  ctx.lineWidth = 0.8
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.save()
  ctx.translate(x1 + 14, (y1 + y2) / 2)
  ctx.rotate(Math.PI / 2)
  ctx.fillStyle = '#333'
  ctx.textAlign = 'center'
  ctx.fillText(label, 0, 0)
  ctx.restore()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/drawAnnotations.ts
git commit -m "feat: render dimension annotations on canvas"
```

---

## Chunk 5: UI Shell + Panels

### Task 11: HTML shell + CSS + Panel tabs

**Files:**
- Modify: `index.html`
- Create: `src/style.css`
- Create: `src/ui/Panel.ts`

- [ ] **Step 1: Write index.html**

Replace generated `index.html`:

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Moldures Designer</title>
</head>
<body class="bg-bg text-text h-dvh overflow-hidden font-sans">

  <div id="app" class="flex flex-col h-dvh">

    <header id="app-header"
      class="h-12 shrink-0 flex items-center gap-3 px-4 bg-surface border-b border-border">
      <span class="font-bold text-accent">🏠 Moldures Designer</span>
      <span id="project-name-display" class="text-muted text-sm"></span>
      <div class="ml-auto flex gap-2 items-center">
        <button id="btn-add-wall">+ Mur</button>
        <button id="btn-settings">⚙️</button>
      </div>
    </header>

    <main class="flex flex-1 overflow-hidden">

      <div id="canvas-container"
        class="flex-1 relative bg-[#111] flex items-center justify-center">
        <canvas id="main-canvas" class="block"></canvas>
        <div id="canvas-overlay"
          class="hidden absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
          <div class="spinner"></div>
          <p class="text-muted text-sm">Génération en cours…</p>
        </div>
      </div>

      <aside id="side-panel"
        class="w-[300px] shrink-0 flex flex-col bg-surface border-l border-border">
        <nav id="panel-tabs" class="flex border-b border-border">
          <button class="tab-btn active" data-tab="project">📁</button>
          <button class="tab-btn" data-tab="wall">🧱</button>
          <button class="tab-btn" data-tab="frames">🔲</button>
          <button class="tab-btn" data-tab="obstacles">🚧</button>
          <button class="tab-btn" data-tab="moldings">🪵</button>
          <button class="tab-btn" data-tab="budget">💰</button>
        </nav>
        <div id="panel-content" class="flex-1 overflow-y-auto p-3"></div>
      </aside>

    </main>

    <footer id="app-toolbar"
      class="h-11 shrink-0 flex items-center gap-2 px-4 bg-surface border-t border-border">
      <button id="btn-pdf">📄 PDF</button>
      <button id="btn-pdf-all">📄 PDF complet</button>
      <button id="btn-gemini">🤖 Gemini</button>
      <button id="btn-save">💾 Sauvegarder</button>
      <label class="btn" for="btn-import">📂 Charger</label>
      <input type="file" id="btn-import" accept=".json" class="hidden" />
    </footer>

  </div>

  <!-- Toast (classe gérée par toast.ts) -->
  <div id="app-toast" class="app-toast"></div>

  <!-- Modal (hidden/visible géré par classList en JS) -->
  <div id="app-modal" class="app-modal hidden">
    <div class="app-modal__inner">
      <button id="modal-close">✕</button>
      <div id="modal-content"></div>
    </div>
  </div>

  <script type="module" src="/src/index.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Write style.css**

Create `src/style.css`:

```css
@import "tailwindcss";

/* ── Design tokens → génère les utilitaires Tailwind (bg-bg, text-muted, border-border…) ── */
@theme {
  --font-family-sans:   system-ui, -apple-system, sans-serif;
  --color-bg:           #1e1e2e;
  --color-surface:      #2a2a3e;
  --color-border:       #3a3a5e;
  --color-text:         #e0e0f0;
  --color-muted:        #8888aa;
  --color-accent:       #5b8dee;
  --color-accent-hover: #7aa3f5;
  --color-danger:       #e05555;
}

/* ── Aliases de compatibilité pour les styles inline dans les templates TS ── */
/* Les templates utilisent var(--text-muted) et var(--accent) directement     */
@layer base {
  :root {
    --text-muted: var(--color-muted);
    --accent:     var(--color-accent);
  }
}

/* ── Resets de base ──────────────────────────────────────────────────────────── */
@layer base {
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font-family-sans); }
  input, select, textarea { font-family: inherit; }
}

/* ── Composants réutilisables (utilisés dans les templates TS) ───────────────── */
@layer components {

  /* Boutons */
  button, .btn {
    @apply px-3 py-1.5 rounded-md border border-border bg-surface text-text text-sm
           cursor-pointer transition-colors duration-150;
    &:hover { @apply bg-border; }
  }
  button.primary, .btn.primary {
    @apply bg-accent border-accent text-white;
    &:hover { @apply bg-accent-hover border-accent-hover; }
  }
  button.danger, .btn.danger {
    @apply bg-transparent border-danger/40 text-danger;
    &:hover { @apply bg-danger/10; }
  }

  /* Onglets du panneau */
  .tab-btn {
    @apply flex-1 py-2.5 px-1 bg-transparent border-0 border-b-2 border-transparent
           text-muted text-lg cursor-pointer transition-colors duration-150;
    &:hover  { @apply text-text; }
    &.active { @apply text-accent border-accent; }
  }

  /* Champs de formulaire */
  .field        { @apply mb-2.5; }
  .field > label { @apply text-xs text-muted block mb-1; }
  .field-row    { @apply flex gap-1.5 items-end; }
  .field-row > .field { @apply flex-1; }

  /* Inputs & selects */
  input[type="number"],
  input[type="text"],
  input[type="password"],
  select {
    @apply w-full px-2 py-1.5 bg-bg border border-border rounded text-text text-sm;
    &:focus { @apply outline-none border-accent; }
  }
  input[type="color"]    { @apply w-9 h-7 p-0.5 border border-border rounded cursor-pointer; }
  input[type="range"]    { @apply w-full; accent-color: var(--color-accent); }
  input[type="checkbox"] { accent-color: var(--color-accent); }

  /* Listes du panneau */
  .section-title { @apply text-xs font-bold uppercase text-muted mt-3.5 mb-2 tracking-wider; }
  .panel-list    { @apply list-none; }
  .panel-list li {
    @apply flex items-center gap-1.5 py-1.5 border-b border-border text-sm;
    &.active-wall { @apply text-accent; }
  }
  .panel-list li .actions { @apply ml-auto flex gap-1; }

  /* Spinner Gemini */
  .spinner {
    @apply w-10 h-10 rounded-full border-4 border-border;
    border-top-color: var(--color-accent);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Toast */
  .app-toast {
    @apply fixed bottom-16 left-1/2 -translate-x-1/2 translate-y-3
           bg-surface border border-border rounded-full px-4 py-2 text-sm
           opacity-0 pointer-events-none;
    z-index: 1000;
    transition: opacity 0.2s, transform 0.2s;
    &.app-toast--visible { @apply opacity-100 translate-y-0; }
    &.app-toast--error   { @apply border-danger text-danger; }
  }

  /* Modal */
  .app-modal {
    @apply fixed inset-0 bg-black/75 flex items-center justify-center;
    z-index: 500;
    &.hidden { display: none; }
  }
  .app-modal__inner {
    @apply relative bg-surface border border-border rounded-xl p-5
           max-w-[90vw] max-h-[90vh] overflow-auto;
  }
  #modal-close {
    @apply absolute top-2 right-2 bg-transparent border-0 text-muted cursor-pointer
           text-base leading-none p-1;
    &:hover { @apply text-text; }
  }

  /* Tableaux */
  table { @apply w-full border-collapse text-xs; }
  th    { @apply text-left text-muted px-1.5 py-1 border-b border-border font-medium; }
  td    { @apply px-1.5 py-1 border-b border-border; }

  /* Badges */
  .badge-restored  { @apply bg-green-900/50 text-green-400 px-2 py-0.5 rounded text-xs; }
  .badge-collision { @apply bg-red-900/50   text-red-400   px-2 py-0.5 rounded text-xs; }

  /* Zones de séparateur */
  .zone-top    { @apply border-l-4 border-accent pl-2; }
  .zone-bottom { @apply border-l-4 border-pink-500 pl-2; }
  .zone-title  { @apply text-sm font-semibold mb-2; }
}
```

- [ ] **Step 3: Write Panel.ts (tab manager avec lit-html)**

> lit-html remplace innerHTML : escaping automatique, events `@click=${fn}` inline,
> DOM diffing (seuls les noeuds modifiés sont mis à jour).
> Le mécanisme `registerPanelEvents` / `attachPanelEvents` est supprimé — les events
> sont maintenant déclarés directement dans les templates des panels.

Create `src/ui/Panel.ts`:

```typescript
import { render } from 'lit-html'
import { subscribe } from '../state/AppState.js'
import { ProjectPanel } from './ProjectPanel.js'
import { WallPanel }    from './WallPanel.js'
import { FramesPanel }  from './FramesPanel.js'
import { ObstaclesPanel } from './ObstaclesPanel.js'
import { MoldingsPanel }  from './MoldingsPanel.js'
import { BudgetPanel }    from './BudgetPanel.js'
import type { TemplateResult } from 'lit-html'

type TabId = 'project' | 'wall' | 'frames' | 'obstacles' | 'moldings' | 'budget'

const panels: Record<TabId, () => TemplateResult> = {
  project:   ProjectPanel,
  wall:      WallPanel,
  frames:    FramesPanel,
  obstacles: ObstaclesPanel,
  moldings:  MoldingsPanel,
  budget:    BudgetPanel,
}

let activeTab: TabId = 'project'

export function initPanel(): void {
  const tabs = document.getElementById('panel-tabs')!

  tabs.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tab-btn') as HTMLElement | null
    if (!btn) return
    const tab = btn.dataset['tab'] as TabId
    if (!tab || tab === activeTab) return
    activeTab = tab
    tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    renderPanel()
  })

  subscribe(() => renderPanel())
  renderPanel()
}

function renderPanel(): void {
  const content = document.getElementById('panel-content')!
  // render() de lit-html : diff DOM — seuls les noeuds changés sont mis à jour
  // Les handlers @click=${fn} sont attachés automatiquement par lit-html
  render(panels[activeTab](), content)
}
```

- [ ] **Step 4: Commit**

```bash
git add index.html src/style.css src/ui/Panel.ts
git commit -m "feat: add HTML shell (Tailwind v4), design tokens and tab panel manager"
```

---

### Task 12: ProjectPanel + WallPanel

**Files:**
- Create: `src/ui/ProjectPanel.ts`
- Create: `src/ui/WallPanel.ts`

- [ ] **Step 1: Write ProjectPanel.ts**

Create `src/ui/ProjectPanel.ts`:

```typescript
import { html } from 'lit-html'
import { nanoid } from 'nanoid'
import { produce } from 'immer'
import { getProject, setState } from '../state/AppState.js'
import { exportProject, importProject, clearStorage } from '../state/storage.js'
import { showToast } from './toast.js'
import { makeDefaultProject } from '../state/defaults.js'
import type { Wall } from '../types/index.js'

// Events inlinés dans le template — pas besoin de registerPanelEvents

function addWall(): void {
  const name = prompt('Nom du mur :', 'Nouveau mur')
  if (!name) return
  const wall: Wall = { ...makeDefaultProject().walls[0]!, id: nanoid(), name }
  setState(s => produce(s, draft => {
    draft.project.walls.push(wall)
    draft.project.activeWallId = wall.id
  }))
}

function renameWall(id: string, currentName: string): void {
  const name = prompt('Nouveau nom :', currentName)
  if (!name) return
  setState(s => produce(s, draft => {
    const w = draft.project.walls.find(w => w.id === id)
    if (w) w.name = name
  }))
}

function duplicateWall(id: string): void {
  const project = getProject()
  const wall = project.walls.find(w => w.id === id)!
  const copy: Wall = { ...wall, id: nanoid(), name: wall.name + ' (copie)' }
  setState(s => produce(s, draft => {
    draft.project.walls.push(copy)
    draft.project.activeWallId = copy.id
  }))
}

function deleteWall(id: string): void {
  if (!confirm('Supprimer ce mur ?')) return
  setState(s => produce(s, draft => {
    const remaining = draft.project.walls.filter(w => w.id !== id)
    draft.project.walls = remaining.length > 0 ? remaining : makeDefaultProject().walls
    if (!draft.project.walls.some(w => w.id === draft.project.activeWallId)) {
      draft.project.activeWallId = draft.project.walls[0]!.id
    }
  }))
}

async function handleImport(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const project = await importProject(file)
    setState(s => produce(s, draft => { draft.project = project }))
    showToast('↩ Projet importé')
  } catch {
    showToast('❌ Fichier invalide', 'error')
  }
}

function resetProject(): void {
  if (!confirm('Réinitialiser le projet ? Toutes les données seront perdues.')) return
  clearStorage()
  setState(s => produce(s, draft => { draft.project = makeDefaultProject() }))
  showToast('🔄 Projet réinitialisé')
}

export function ProjectPanel() {
  const project = getProject()

  return html`
    <div class="section-title">Murs du projet — ${project.name}</div>
    <ul class="panel-list">
      ${project.walls.map(w => html`
        <li class=${w.id === project.activeWallId ? 'active-wall' : ''}
            @click=${(e: Event) => {
              if ((e.target as HTMLElement).closest('button')) return
              setState(s => produce(s, draft => { draft.project.activeWallId = w.id }))
            }}>
          <span class="wall-name">${w.name}</span>
          <div class="actions">
            <button @click=${() => renameWall(w.id, w.name)} title="Renommer">✏️</button>
            <button @click=${() => duplicateWall(w.id)} title="Dupliquer">📋</button>
            <button class="danger" @click=${() => deleteWall(w.id)} title="Supprimer">🗑️</button>
          </div>
        </li>`
      )}
    </ul>
    <button class="primary w-full mt-2" @click=${addWall}>+ Ajouter un mur</button>
    <div class="section-title mt-4">Projet</div>
    <div class="field-row">
      <button @click=${() => exportProject(getProject())}>📤 Exporter JSON</button>
      <label class="btn" for="import-json-input">📥 Importer JSON</label>
      <input type="file" id="import-json-input" accept=".json" style="display:none"
             @change=${handleImport} />
    </div>
    <button class="danger mt-2" @click=${resetProject}>🔄 Réinitialiser</button>
  `
}
```

- [ ] **Step 2: Write WallPanel.ts**

Create `src/ui/WallPanel.ts`:

```typescript
import { html } from 'lit-html'
import { nanoid } from 'nanoid'
import { produce } from 'immer'
import { getActiveWall, setState } from '../state/AppState.js'

function updateWall(recipe: (w: NonNullable<ReturnType<typeof getActiveWall>>) => void): void {
  setState(s => produce(s, draft => {
    const wall = draft.project.walls.find(w => w.id === draft.project.activeWallId)
    if (wall) recipe(wall)
  }))
}

export function WallPanel() {
  const wall = getActiveWall()
  if (!wall) return html`<p>Aucun mur sélectionné.</p>`

  return html`
    <div class="field">
      <label>Nom du mur</label>
      <input type="text" .value=${wall.name}
             @input=${(e: Event) => updateWall(w => { w.name = (e.target as HTMLInputElement).value })} />
    </div>
    <div class="section-title">Dimensions</div>
    <div class="field-row">
      <div class="field">
        <label>Largeur (cm)</label>
        <input type="number" .value=${wall.dimensions.width} min="50" max="2000"
               @input=${(e: Event) => updateWall(w => { w.dimensions.width = Number((e.target as HTMLInputElement).value) })} />
      </div>
      <div class="field">
        <label>Hauteur (cm)</label>
        <input type="number" .value=${wall.dimensions.height} min="50" max="500"
               @input=${(e: Event) => updateWall(w => { w.dimensions.height = Number((e.target as HTMLInputElement).value) })} />
      </div>
    </div>
    <div class="field">
      <label>Hauteur plinthe (cm)</label>
      <input type="number" .value=${wall.dimensions.plinthHeight} min="0" max="50"
             @input=${(e: Event) => updateWall(w => { w.dimensions.plinthHeight = Number((e.target as HTMLInputElement).value) })} />
    </div>
    <div class="section-title">Zones</div>
    <div class="field-row">
      <button class=${wall.zoneMode === '1zone' ? 'primary' : ''}
              @click=${() => updateWall(w => {
                if (w.zoneMode === '1zone') return
                w.archivedBottomZone = w.zones.find(z => z.type === 'bottom')
                w.zones = w.zones.filter(z => z.type !== 'bottom').map(z => ({ ...z, type: 'full' as const }))
                w.zoneMode = '1zone'; w.separator = undefined
              })}>1 zone</button>
      <button class=${wall.zoneMode === '2zones' ? 'primary' : ''}
              @click=${() => updateWall(w => {
                if (w.zoneMode === '2zones') return
                const topZone = { ...w.zones[0]!, type: 'top' as const }
                const botZone = w.archivedBottomZone ?? { ...w.zones[0]!, id: nanoid(), type: 'bottom' as const }
                w.zones = [topZone, botZone]
                w.zoneMode = '2zones'
                w.separator = w.separator ?? { positionPercent: 60, visible: true, moldingId: w.zones[0]?.frames[0]?.moldingId ?? 'm1' }
              })}>2 zones</button>
    </div>
    <div class="section-title">Couleurs</div>
    <div class="field-row">
      <div class="field">
        <label>Mur</label>
        <input type="color" .value=${wall.colors.wall}
               @input=${(e: Event) => updateWall(w => { w.colors.wall = (e.target as HTMLInputElement).value })} />
      </div>
      <div class="field">
        <label>Moulures</label>
        <input type="color" .value=${wall.colors.moldings || '#e8d5b0'}
               @input=${(e: Event) => {
                 const override = (document.getElementById('color-moldings-override') as HTMLInputElement | null)?.checked
                 updateWall(w => { w.colors.moldings = override ? (e.target as HTMLInputElement).value : '' })
               }} />
        <label class="mt-1">
          <input type="checkbox" id="color-moldings-override" ?checked=${!!wall.colors.moldings}
                 @change=${(e: Event) => {
                   const checked = (e.target as HTMLInputElement).checked
                   const color = (document.getElementById('color-moldings') as HTMLInputElement | null)?.value ?? '#e8d5b0'
                   updateWall(w => { w.colors.moldings = checked ? color : '' })
                 }} />
          Override global
        </label>
      </div>
      <div class="field">
        <label>Plinthe</label>
        <input type="color" .value=${wall.colors.plinth}
               @input=${(e: Event) => updateWall(w => { w.colors.plinth = (e.target as HTMLInputElement).value })} />
      </div>
    </div>
    <div class="field mt-2">
      <label>
        <input type="checkbox" ?checked=${wall.showAnnotations}
               @change=${(e: Event) => updateWall(w => { w.showAnnotations = (e.target as HTMLInputElement).checked })} />
        Afficher les cotes
      </label>
    </div>
  `
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/ProjectPanel.ts src/ui/WallPanel.ts
git commit -m "feat: add ProjectPanel and WallPanel with full state binding"
```

---

### Task 13: FramesPanel

**Files:**
- Create: `src/ui/FramesPanel.ts`

- [ ] **Step 1: Write FramesPanel.ts**

Create `src/ui/FramesPanel.ts`:

```typescript
import { html } from 'lit-html'
import { nanoid } from 'nanoid'
import { produce } from 'immer'
import { getActiveWall, getProject, setState } from '../state/AppState.js'

type Zone = NonNullable<ReturnType<typeof getActiveWall>>['zones'][number]

function updateZone(zoneId: string, recipe: (z: Zone) => void): void {
  setState(s => produce(s, draft => {
    const wall = draft.project.walls.find(w => w.id === draft.project.activeWallId)
    const zone = wall?.zones.find(z => z.id === zoneId)
    if (zone) recipe(zone)
  }))
}

function setFrameCount(zoneId: string, count: number): void {
  updateZone(zoneId, z => {
    z.layout.frameCount = count
    while (z.layout.customWidths.length  < count) z.layout.customWidths.push(0)
    while (z.layout.customHeights.length < count) z.layout.customHeights.push(0)
    z.layout.customWidths  = z.layout.customWidths.slice(0, count)
    z.layout.customHeights = z.layout.customHeights.slice(0, count)
    while (z.frames.length < count) z.frames.push({ id: nanoid(), moldingId: z.frames[0]?.moldingId ?? 'm1', cornerStyle: 'miter', nestedLevels: [] })
    z.frames = z.frames.slice(0, count)
  })
}

function zoneSection(zone: Zone, moldingOptions: ReturnType<typeof html>[]) {
  const cls  = zone.type === 'top' ? 'zone-top' : zone.type === 'bottom' ? 'zone-bottom' : ''
  const title = zone.type === 'top' ? 'Zone haute' : zone.type === 'bottom' ? 'Zone basse' : 'Zone'
  const l = zone.layout
  return html`
    <div class=${cls} style="padding-left:8px;margin-bottom:16px">
      <div class="zone-title">${title}</div>
      <div class="field-row">
        ${[1,2,3,4,5,6].map(n => html`
          <button class=${l.frameCount === n ? 'primary' : ''}
                  @click=${() => setFrameCount(zone.id, n)}>${n}</button>`)}
      </div>
      <div class="section-title">Marges (cm)</div>
      <div class="field-row">
        ${(['left','right','top','bottom'] as const).map(side => html`
          <div class="field">
            <label>${side.charAt(0).toUpperCase() + side.slice(1)}</label>
            <input type="number" .value=${l[`margin${side.charAt(0).toUpperCase()+side.slice(1)}` as 'marginLeft']} min="0"
                   @input=${(e: Event) => updateZone(zone.id, z => {
                     z.layout[`margin${side.charAt(0).toUpperCase()+side.slice(1)}` as 'marginLeft'] = Number((e.target as HTMLInputElement).value)
                   })} />
          </div>`)}
      </div>
      <div class="field">
        <label>Gap entre cadres (cm)</label>
        <input type="number" .value=${l.gapBetweenFrames} min="0"
               @input=${(e: Event) => updateZone(zone.id, z => { z.layout.gapBetweenFrames = Number((e.target as HTMLInputElement).value) })} />
      </div>
      <div class="section-title">Tailles custom (0 = auto)</div>
      <table><thead><tr><th>#</th><th>Largeur</th><th>Hauteur</th></tr></thead>
        <tbody>
          ${Array.from({ length: l.frameCount }, (_, i) => html`
            <tr>
              <td>${i + 1}</td>
              <td><input type="number" .value=${l.customWidths[i] ?? 0} min="0"
                         @input=${(e: Event) => updateZone(zone.id, z => { z.layout.customWidths[i] = Number((e.target as HTMLInputElement).value) })} /></td>
              <td><input type="number" .value=${l.customHeights[i] ?? 0} min="0"
                         @input=${(e: Event) => updateZone(zone.id, z => { z.layout.customHeights[i] = Number((e.target as HTMLInputElement).value) })} /></td>
            </tr>`)}
        </tbody>
      </table>
      ${zone.frames[0] ? html`
        <div class="section-title">Imbrication (cadre 1)</div>
        ${zone.frames[0].nestedLevels.map((lvl, j) => html`
          <div class="field-row">
            <div class="field"><label>Décalage (cm)</label>
              <input type="number" .value=${lvl.offset} min="0" step="0.5"
                     @input=${(e: Event) => updateZone(zone.id, z => { if (z.frames[0]) z.frames[0].nestedLevels[j]!.offset = Number((e.target as HTMLInputElement).value) })} />
            </div>
            <div class="field"><label>Moulure</label>
              <select @change=${(e: Event) => updateZone(zone.id, z => { if (z.frames[0]) z.frames[0].nestedLevels[j]!.moldingId = (e.target as HTMLSelectElement).value })}>
                ${moldingOptions}
              </select>
            </div>
            <button class="danger" @click=${() => updateZone(zone.id, z => { z.frames[0]?.nestedLevels.splice(j, 1) })}>✕</button>
          </div>`)}
        <button @click=${() => updateZone(zone.id, z => { z.frames[0]?.nestedLevels.push({ offset: 2, moldingId: z.frames[0].moldingId, cornerStyle: 'miter' }) })}>+ Ajouter niveau</button>
      ` : ''}
    </div>`
}

export function FramesPanel() {
  const wall = getActiveWall()
  const project = getProject()
  if (!wall) return html`<p>Aucun mur.</p>`

  const moldingOptions = project.moldings.map(m => html`<option value=${m.id}>${m.name}</option>`)

  const sep = wall.separator
  return html`
    ${wall.zones.map(zone => zoneSection(zone, moldingOptions))}
    ${wall.zoneMode === '2zones' && sep ? html`
      <div class="section-title">Séparateur / Rail</div>
      <div class="field-row">
        <div class="field">
          <label>Position (${sep.positionPercent}%)</label>
          <input type="range" min="20" max="80" .value=${sep.positionPercent}
                 @input=${(e: Event) => setState(s => produce(s, draft => {
                   const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
                   if (w?.separator) w.separator.positionPercent = Number((e.target as HTMLInputElement).value)
                 }))} />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>
            <input type="checkbox" ?checked=${sep.visible}
                   @change=${(e: Event) => setState(s => produce(s, draft => {
                     const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
                     if (w?.separator) w.separator.visible = (e.target as HTMLInputElement).checked
                   }))} />
            Afficher le rail
          </label>
        </div>
        <div class="field">
          <label>Moulure rail</label>
          <select @change=${(e: Event) => setState(s => produce(s, draft => {
            const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
            if (w?.separator) w.separator.moldingId = (e.target as HTMLSelectElement).value
          }))}>
            ${project.moldings.map(m => html`<option value=${m.id} ?selected=${m.id === sep.moldingId}>${m.name}</option>`)}
          </select>
        </div>
      </div>
    ` : ''}
  `
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/FramesPanel.ts
git commit -m "feat: add FramesPanel with zones, margins, custom sizes and nesting"
```

---

### Task 14: MoldingsPanel + ObstaclesPanel + BudgetPanel

**Files:**
- Create: `src/ui/MoldingsPanel.ts`
- Create: `src/ui/ObstaclesPanel.ts`
- Create: `src/ui/BudgetPanel.ts`

- [ ] **Step 1: Write MoldingsPanel.ts**

> **Audit fix:** lit-html tagged templates (XSS-safe, no `registerPanelEvents`), `nanoid()` instead of `crypto.randomUUID()`.
> Modal forms rendered with `render()` from lit-html, `.value=${x}` for inputs.
> Edit support: `saveMolding(existingId?)` upserts by id.

Create `src/ui/MoldingsPanel.ts`:

```typescript
import { produce } from 'immer'
import { html, render } from 'lit-html'
import type { TemplateResult } from 'lit-html'
import { nanoid } from 'nanoid'
import { getProject, setState } from '../state/AppState.js'
import type { Molding, Rosette } from '../types/index.js'

export function MoldingsPanel(): TemplateResult {
  const project = getProject()
  return html`
    <div class="section-title">Moulures</div>
    <ul class="panel-list">
      ${project.moldings.length === 0
        ? html`<li style="color:var(--text-muted)">Aucune moulure</li>`
        : project.moldings.map(m => html`
          <li>
            <span style="display:inline-block;width:12px;height:12px;background:${m.color};border-radius:2px;margin-right:6px"></span>
            <span>${m.name}</span>
            <small style="color:var(--text-muted)">${m.width}×${m.thickness}mm · ${m.barLength}cm · ${m.pricePerBar}€</small>
            <div class="actions">
              <button @click=${() => showMoldingModal(m)}>✏️</button>
              <button class="danger" @click=${() => {
                if (!confirm('Supprimer cette moulure ?')) return
                setState(s => produce(s, draft => {
                  draft.project.moldings = draft.project.moldings.filter(x => x.id !== m.id)
                }))
              }}>🗑️</button>
            </div>
          </li>`)}
    </ul>
    <button class="primary" style="width:100%;margin-top:6px" @click=${() => showMoldingModal()}>+ Ajouter moulure</button>

    <div class="section-title" style="margin-top:16px">Rosettes d'angle</div>
    <ul class="panel-list">
      ${project.rosettes.length === 0
        ? html`<li style="color:var(--text-muted)">Aucune rosette</li>`
        : project.rosettes.map(r => html`
          <li>
            <span>${r.name}</span>
            <small style="color:var(--text-muted)">${r.size}cm · ${r.pricePerPiece}€/pce</small>
            <div class="actions">
              <button class="danger" @click=${() => setState(s => produce(s, draft => {
                draft.project.rosettes = draft.project.rosettes.filter(x => x.id !== r.id)
              }))}>🗑️</button>
            </div>
          </li>`)}
    </ul>
    <button style="width:100%;margin-top:6px" @click=${addRosette}>+ Ajouter rosette</button>
  `
}

function moldingFormTpl(m?: Molding): TemplateResult {
  const existingId = m?.id
  return html`
    <div style="min-width:260px">
      <h3 style="margin-bottom:12px">${m ? 'Modifier' : 'Nouvelle'} moulure</h3>
      <div class="field"><label>Nom</label><input type="text" id="mf-name" .value=${m?.name ?? ''} /></div>
      <div class="field"><label>Référence</label><input type="text" id="mf-ref" .value=${m?.reference ?? ''} /></div>
      <div class="field-row">
        <div class="field"><label>Largeur (mm)</label><input type="number" id="mf-width" .value=${String(m?.width ?? 16)} min="1" /></div>
        <div class="field"><label>Épaisseur (mm)</label><input type="number" id="mf-thick" .value=${String(m?.thickness ?? 29)} min="1" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Longueur barre (cm)</label><input type="number" id="mf-bar" .value=${String(m?.barLength ?? 270)} min="10" /></div>
        <div class="field"><label>Prix/barre (€)</label><input type="number" id="mf-price" .value=${String(m?.pricePerBar ?? 0)} min="0" step="0.01" /></div>
      </div>
      <div class="field"><label>Couleur</label><input type="color" id="mf-color" .value=${m?.color ?? '#e8d5b0'} /></div>
      <button class="primary" style="margin-top:10px;width:100%" @click=${() => saveMolding(existingId)}>Enregistrer</button>
    </div>`
}

function showMoldingModal(m?: Molding): void {
  render(moldingFormTpl(m), document.getElementById('modal-content')!)
  document.getElementById('app-modal')!.classList.remove('hidden')
}

function saveMolding(existingId?: string): void {
  const molding: Molding = {
    id:          existingId ?? nanoid(),
    name:        (document.getElementById('mf-name')  as HTMLInputElement).value,
    reference:   (document.getElementById('mf-ref')   as HTMLInputElement).value,
    width:       Number((document.getElementById('mf-width') as HTMLInputElement).value),
    thickness:   Number((document.getElementById('mf-thick') as HTMLInputElement).value),
    barLength:   Number((document.getElementById('mf-bar')   as HTMLInputElement).value),
    pricePerBar: Number((document.getElementById('mf-price') as HTMLInputElement).value),
    color:       (document.getElementById('mf-color') as HTMLInputElement).value,
  }
  setState(s => produce(s, draft => {
    const idx = draft.project.moldings.findIndex(x => x.id === molding.id)
    if (idx >= 0) draft.project.moldings[idx] = molding
    else          draft.project.moldings.push(molding)
  }))
  document.getElementById('app-modal')!.classList.add('hidden')
}

function addRosette(): void {
  const name = prompt('Nom de la rosette :'); if (!name) return
  const size  = Number(prompt('Taille (cm) :', '20.5'))
  const price = Number(prompt('Prix/pièce (€) :', '9.68'))
  const r: Rosette = { id: nanoid(), name, reference: '', size, pricePerPiece: price }
  setState(s => produce(s, draft => { draft.project.rosettes.push(r) }))
}
```

- [ ] **Step 2: Write ObstaclesPanel.ts**

> **Audit fix:** lit-html tagged templates, `nanoid()`, inline event handlers, `render()` for modal.
> `.value=${x}` for inputs, `?checked=${x}` for checkbox, `?selected=${x}` for options.
> Edit support: `saveObstacle(wall, existingId?)` upserts by id.

Create `src/ui/ObstaclesPanel.ts`:

```typescript
import { produce } from 'immer'
import { html, render } from 'lit-html'
import type { TemplateResult } from 'lit-html'
import { nanoid } from 'nanoid'
import { getActiveWall, setState } from '../state/AppState.js'
import type { Obstacle, ObstacleType, Wall } from '../types/index.js'

const OBSTACLE_ICONS: Record<ObstacleType, string> = {
  window: '🪟', door: '🚪', radiator: '🔥',
  outlet: '🔌', switch: '💡', fireplace: '🔥', custom: '📦',
}

export function ObstaclesPanel(): TemplateResult {
  const wall = getActiveWall()
  if (!wall) return html`<p>Aucun mur.</p>`

  return html`
    <div class="section-title">Obstacles</div>
    <ul class="panel-list">
      ${wall.obstacles.length === 0
        ? html`<li style="color:var(--text-muted)">Aucun obstacle</li>`
        : wall.obstacles.map(o => html`
          <li>
            <span>${OBSTACLE_ICONS[o.type]} ${o.name}</span>
            <small style="color:var(--text-muted)">${o.width}×${o.height}cm @ (${o.positionX}, ${o.positionY})</small>
            <div class="actions">
              <button @click=${() => showObstacleModal(o)}>✏️</button>
              <button class="danger" @click=${() => setState(s => produce(s, draft => {
                const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
                if (w) w.obstacles = w.obstacles.filter(x => x.id !== o.id)
              }))}>🗑️</button>
            </div>
          </li>`)}
    </ul>
    <button class="primary" style="width:100%;margin-top:6px" @click=${() => showObstacleModal()}>+ Ajouter obstacle</button>
  `
}

const OBS_TYPES: ObstacleType[] = ['window','door','radiator','outlet','switch','fireplace','custom']

function obstacleFormTpl(wall: Wall, o?: Obstacle): TemplateResult {
  return html`
    <div style="min-width:260px">
      <h3 style="margin-bottom:12px">${o ? 'Modifier' : 'Nouvel'} obstacle</h3>
      <div class="field">
        <label>Type</label>
        <select id="obs-type">
          ${OBS_TYPES.map(t => html`<option value=${t} ?selected=${o?.type === t}>${OBSTACLE_ICONS[t]} ${t}</option>`)}
        </select>
      </div>
      <div class="field"><label>Nom</label><input type="text" id="obs-name" .value=${o?.name ?? ''} /></div>
      <div class="field-row">
        <div class="field"><label>Largeur (cm)</label><input type="number" id="obs-w" .value=${String(o?.width ?? 90)} min="1" /></div>
        <div class="field"><label>Hauteur (cm)</label><input type="number" id="obs-h" .value=${String(o?.height ?? 90)} min="1" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>X depuis gauche (cm)</label><input type="number" id="obs-x" .value=${String(o?.positionX ?? 15)} min="0" /></div>
        <div class="field"><label>Y depuis sol (cm)</label><input type="number" id="obs-y" .value=${String(o?.positionY ?? 5)} min="0" /></div>
      </div>
      <div id="obs-bounds-error" style="color:#e05555;font-size:0.8rem;display:none">⚠ Hors limites du mur</div>
      <div class="field">
        <label>
          <input type="checkbox" id="obs-transparent" ?checked=${o?.display.transparent ?? false}
                 @change=${(e: Event) => {
                   const checked = (e.target as HTMLInputElement).checked
                   const cf = document.getElementById('obs-color-field')
                   if (cf) cf.style.display = checked ? 'none' : ''
                 }} />
          Transparent
        </label>
      </div>
      <div class="field" id="obs-color-field" style=${o?.display.transparent ? 'display:none' : ''}>
        <label>Couleur</label>
        <input type="color" id="obs-color" .value=${o?.display.fillColor ?? '#aaaaaa'} />
      </div>
      <button class="primary" style="margin-top:10px;width:100%" @click=${() => saveObstacle(wall, o?.id)}>Enregistrer</button>
    </div>`
}

function showObstacleModal(o?: Obstacle): void {
  const wall = getActiveWall()
  if (!wall) return
  render(obstacleFormTpl(wall, o), document.getElementById('modal-content')!)
  document.getElementById('app-modal')!.classList.remove('hidden')
}

function saveObstacle(wall: Wall, existingId?: string): void {
  const obsW  = Number((document.getElementById('obs-w') as HTMLInputElement).value)
  const obsH  = Number((document.getElementById('obs-h') as HTMLInputElement).value)
  const obsX  = Number((document.getElementById('obs-x') as HTMLInputElement).value)
  const obsY  = Number((document.getElementById('obs-y') as HTMLInputElement).value)
  const errEl = document.getElementById('obs-bounds-error')!
  if (obsX + obsW > wall.dimensions.width || obsY + obsH > wall.dimensions.height) {
    errEl.style.display = ''; return
  }
  errEl.style.display = 'none'
  const obs: Obstacle = {
    id:   existingId ?? nanoid(),
    name: (document.getElementById('obs-name')  as HTMLInputElement).value,
    type: (document.getElementById('obs-type')  as HTMLSelectElement).value as ObstacleType,
    width: obsW, height: obsH, positionX: obsX, positionY: obsY,
    display: {
      transparent: (document.getElementById('obs-transparent') as HTMLInputElement).checked,
      fillColor:   (document.getElementById('obs-color')       as HTMLInputElement).value,
    },
  }
  setState(s => produce(s, draft => {
    const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
    if (!w) return
    const idx = w.obstacles.findIndex(x => x.id === obs.id)
    if (idx >= 0) w.obstacles[idx] = obs
    else          w.obstacles.push(obs)
  }))
  document.getElementById('app-modal')!.classList.add('hidden')
}
```

- [ ] **Step 3: Write BudgetPanel.ts**

> **Audit fix:** lit-html tagged templates (read-only panel, no user input — simpler migration).

Create `src/ui/BudgetPanel.ts`:

```typescript
import { html } from 'lit-html'
import type { TemplateResult } from 'lit-html'
import { getActiveWall, getProject } from '../state/AppState.js'
import { computeBudget } from '../services/budget.js'

export function BudgetPanel(): TemplateResult {
  const wall    = getActiveWall()
  const project = getProject()
  if (!wall) return html`<p>Aucun mur.</p>`

  const budget = computeBudget(project, wall)

  return html`
    <div class="section-title">Récapitulatif budget</div>
    <table>
      <thead><tr><th>Moulure</th><th>ml</th><th>Chute</th><th>Barres</th><th>Coût</th></tr></thead>
      <tbody>
        ${budget.lines.map(l => html`
          <tr>
            <td>${l.moldingName}</td>
            <td>${l.linearMeters.toFixed(2)}</td>
            <td>${l.wasteFactor === 1.15 ? '+15%' : '—'}</td>
            <td>${l.barsNeeded}</td>
            <td>${l.totalCost.toFixed(2)} €</td>
          </tr>`)}
        ${budget.rosetteLines.map(r => html`
          <tr>
            <td>${r.rosetteName}</td>
            <td>—</td><td>—</td>
            <td>${r.count} ×</td>
            <td>${r.totalCost.toFixed(2)} €</td>
          </tr>`)}
        ${budget.lines.length === 0 && budget.rosetteLines.length === 0
          ? html`<tr><td colspan="5" style="color:var(--text-muted);text-align:center">Aucun cadre défini</td></tr>`
          : ''}
      </tbody>
      <tfoot>
        <tr style="font-weight:700">
          <td colspan="4">TOTAL</td>
          <td>${budget.totalCost.toFixed(2)} €</td>
        </tr>
      </tfoot>
    </table>
    <p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
      +15% chute inclus pour les cadres. Mis à jour en temps réel.
    </p>
  `
}
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/MoldingsPanel.ts src/ui/ObstaclesPanel.ts src/ui/BudgetPanel.ts
git commit -m "feat: add MoldingsPanel, ObstaclesPanel and BudgetPanel"
```

---

## Chunk 6: Services (PDF + Gemini)

### Task 15: PDF export

**Files:**
- Create: `src/services/pdf.ts`

- [ ] **Step 1: Write pdf.ts**

Create `src/services/pdf.ts`:

```typescript
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Project, Wall } from '../types/index.js'
import { computeBudget } from './budget.js'
import { computeFrameLayout, computeZoneRect } from './layout.js'
// renderToCanvas est la version PURE (sans side-effects) — obligatoire ici pour ne pas
// corrompre _lastCanvas dans Renderer.ts (le zoom wheel pointerait sur le canvas off-screen)
import { renderToCanvas } from '../renderer/Renderer.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Render the wall onto a dedicated off-screen canvas at 2× the display
 * resolution, then return a PNG data URL. Avoids blurry PDFs on Retina screens.
 * Utilise renderToCanvas (pure) pour ne pas écraser _lastCanvas du renderer.
 */
function getHighResDataUrl(canvas: HTMLCanvasElement, wall: Wall, project: Project): string {
  const EXPORT_SCALE = 2
  const off = document.createElement('canvas')
  off.width  = canvas.clientWidth  * EXPORT_SCALE
  off.height = canvas.clientHeight * EXPORT_SCALE
  off.style.width  = canvas.clientWidth  + 'px'
  off.style.height = canvas.clientHeight + 'px'
  const ctx = off.getContext('2d')!
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE)
  renderToCanvas(off, wall, project)          // ← pure, pas de side-effects
  return off.toDataURL('image/png')
}

/** didDrawPage callback that adds a centered page number footer. */
function pageNumberFooter(pdf: jsPDF) {
  return {
    didDrawPage: (data: { pageNumber: number }) => {
      pdf.setFontSize(8)
      pdf.setTextColor(150)
      pdf.text(
        `Page ${data.pageNumber}`,
        pdf.internal.pageSize.getWidth() / 2,
        pdf.internal.pageSize.getHeight() - 4,
        { align: 'center' }
      )
      pdf.setTextColor(0)
    },
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function exportWallPdf(canvas: HTMLCanvasElement, project: Project, wall: Wall): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  addWallPage(pdf, canvas, project, wall)
  pdf.save(`${project.name}-${wall.name}.pdf`)
}

export async function exportAllWallsPdf(canvas: HTMLCanvasElement, project: Project): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  for (let i = 0; i < project.walls.length; i++) {
    if (i > 0) pdf.addPage()
    addWallPage(pdf, canvas, project, project.walls[i]!)
  }
  pdf.save(`${project.name}-complet.pdf`)
}

function addWallPage(pdf: jsPDF, canvas: HTMLCanvasElement, project: Project, wall: Wall): void {
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  const date = new Date().toLocaleDateString('fr-FR')

  // ── Page 1: header + canvas image (2× resolution) + dimensions ──
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`${project.name} — ${wall.name}`, 10, 12)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Généré le ${date}`, pw - 10, 12, { align: 'right' })

  // High-res canvas export (avoids blur on Retina/print)
  const imgData = getHighResDataUrl(canvas, wall, project)
  const imgW = pw * 0.55
  const imgH = ph * 0.75
  pdf.addImage(imgData, 'PNG', 10, 18, imgW, imgH)

  // Dimensions box (right side)
  const bx = imgW + 15
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Dimensions du mur', bx, 22)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  const { width, height, plinthHeight } = wall.dimensions
  const dimLines = [
    `Largeur : ${width} cm`,
    `Hauteur : ${height} cm`,
    `Plinthe : ${plinthHeight} cm`,
    `Utile   : ${height - plinthHeight} cm`,
    `Mode    : ${wall.zoneMode}`,
  ]
  dimLines.forEach((line, i) => pdf.text(line, bx, 30 + i * 6))

  // ── Page 2: measurements + budget ──
  pdf.addPage()

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Mesures — ${wall.name}`, 10, 12)

  // Frame measurements table
  const frameRows: (string | number)[][] = []
  for (const zone of wall.zones) {
    const zoneRect = computeZoneRect(wall, zone.type)
    const rects = computeFrameLayout(zone, zoneRect)
    for (const rect of rects) {
      frameRows.push([
        `Zone ${zone.type} — Cadre ${rect.frameIndex + 1}`,
        Math.round(rect.width),
        Math.round(rect.height),
        Math.round(2 * (rect.width + rect.height)),
      ])
    }
  }

  autoTable(pdf, {
    startY: 18,
    head: [['Cadre', 'Largeur (cm)', 'Hauteur (cm)', 'Périmètre (cm)']],
    body: frameRows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [60, 80, 150] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    ...pageNumberFooter(pdf),
  })

  const budget = computeBudget(project, wall)
  const budgetY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Liste de matériaux', 10, budgetY)

  const budgetRows = [
    ...budget.lines.map(l => [l.moldingName, l.linearMeters.toFixed(2) + ' ml', l.wasteFactor === 1.15 ? '+15%' : '—', String(l.barsNeeded), l.totalCost.toFixed(2) + ' €']),
    ...budget.rosetteLines.map(r => [r.rosetteName, '—', '—', `${r.count} pcs`, r.totalCost.toFixed(2) + ' €']),
  ]

  autoTable(pdf, {
    startY: budgetY + 4,
    head: [['Moulure / Rosette', 'Linéaire', 'Chute', 'Qté', 'Coût']],
    body: budgetRows,
    foot: [['TOTAL', '', '', '', budget.totalCost.toFixed(2) + ' €']],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [60, 80, 150] },
    footStyles: { fontStyle: 'bold', fillColor: [220, 220, 240] },
    columnStyles: { 4: { halign: 'right' } },
    ...pageNumberFooter(pdf),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/pdf.ts
git commit -m "feat: add PDF export with 2x hi-res canvas, budget table and page numbers"
```

---

### Task 16: Gemini service

**Files:**
- Create: `src/services/gemini.ts`

- [ ] **Step 1: Write gemini.ts**

Create `src/services/gemini.ts`:

```typescript
import { GoogleGenAI } from '@google/genai'
import type { Project, Wall } from '../types/index.js'

export type GeminiModel = 'gemini-flash' | 'imagen-4'

const MODEL_IDS: Record<GeminiModel, string> = {
  'gemini-flash': 'gemini-2.0-flash-preview-image-generation',
  'imagen-4':     'imagen-4.0-generate-001',
}

const TIMEOUT_MS = 30_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new GeminiError('Délai dépassé. Réessayez.')), ms)
    ),
  ])
}

export async function generateWallRender(
  wall: Wall,
  project: Project,
  apiKey: string,
  model: GeminiModel = 'gemini-flash',
): Promise<string> {
  if (!apiKey) throw new GeminiError('Clé API manquante. Configurez-la dans ⚙️ Paramètres.')

  const ai = new GoogleGenAI({ apiKey })
  const prompt = buildPrompt(wall, project)

  try {
    const generate = model === 'imagen-4'
      ? generateWithImagen(ai, prompt)
      : generateWithGeminiFlash(ai, prompt)
    return await withTimeout(generate, TIMEOUT_MS)
  } catch (err) {
    throw translateError(err)
  }
}

async function generateWithGeminiFlash(ai: GoogleGenAI, prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL_IDS['gemini-flash'],
    contents: [{ parts: [{ text: prompt }] }],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  })
  const parts = response.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data)
  if (!imagePart?.inlineData?.data) throw new GeminiError('Aucune image dans la réponse Gemini.')
  return imagePart.inlineData.data
}

async function generateWithImagen(ai: GoogleGenAI, prompt: string): Promise<string> {
  const response = await ai.models.generateImages({
    model: MODEL_IDS['imagen-4'],
    prompt,
    config: { numberOfImages: 1, aspectRatio: '16:9', includeRaiReason: true },
  })
  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes
  if (!imageBytes) throw new GeminiError('Aucune image dans la réponse Imagen.')
  return imageBytes
}

export function buildPrompt(wall: Wall, project: Project): string {
  const obstacles = wall.obstacles.map(o => `${o.name} (${o.width}×${o.height}cm)`).join(', ')
  const zoneTop = wall.zones.find(z => z.type === 'top' || z.type === 'full')
  const zoneBot = wall.zones.find(z => z.type === 'bottom')
  const moldingColor = wall.colors.moldings || 'white'

  return [
    'Photorealistic interior wall, classical French Haussmann style.',
    `Wall: ${wall.dimensions.width}cm wide × ${wall.dimensions.height}cm tall.`,
    `Wall color: ${wall.colors.wall}. Molding color: ${moldingColor}.`,
    zoneTop ? `Upper zone with ${zoneTop.layout.frameCount} rectangular decorative molding frames.` : '',
    zoneBot ? `Lower zone with ${zoneBot.layout.frameCount} rectangular decorative molding frames.` : '',
    wall.separator?.visible ? `Horizontal rail separator at ${wall.separator.positionPercent}% height.` : '',
    obstacles ? `Wall elements: ${obstacles}.` : '',
    'Style: elegant classical interior, soft natural light, high quality render, 4K.',
  ].filter(Boolean).join(' ')
}

class GeminiError extends Error {
  constructor(message: string) { super(message); this.name = 'GeminiError' }
}

function translateError(err: unknown): GeminiError {
  if (err instanceof GeminiError) return err
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('401') || msg.includes('API_KEY')) return new GeminiError('Clé API invalide. Vérifiez vos paramètres.')
  if (msg.includes('429')) return new GeminiError('Quota Gemini atteint. Réessayez plus tard.')
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return new GeminiError('Connexion impossible. Vérifiez votre réseau.')
  return new GeminiError(`Erreur Gemini : ${msg}`)
}
// Note: GeminiError from withTimeout is caught by `err instanceof GeminiError` guard above and returned as-is.
```

- [ ] **Step 2: Commit**

```bash
git add src/services/gemini.ts
git commit -m "feat: add Gemini service with Flash and Imagen-4 models"
```

---

## Chunk 7: Integration & Deployment

### Task 17: index.ts — wiring everything together

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Write index.ts**

Replace generated `src/index.ts`:

```typescript
import './style.css'
import { produce } from 'immer'
import { getState, setState, subscribe, getActiveWall, getProject, undo, redo } from './state/AppState.js'
import { loadProject, loadGeminiKey, autoSave, saveGeminiKey, exportProject, importProject } from './state/storage.js'
import { showToast } from './ui/toast.js'
import { initPanel } from './ui/Panel.js'
import { renderWithState, setupCanvas, initZoom, resetZoom } from './renderer/Renderer.js'
import { exportWallPdf, exportAllWallsPdf } from './services/pdf.js'
import { generateWallRender } from './services/gemini.js'
// Audit fix: h() escapes user-controlled values injected via innerHTML (XSS prevention)
import { h } from './utils/h.js'

// ── Boot ─────────────────────────────────────────────────────────────────────

function boot(): void {
  // Restore or default project
  const { project, restored } = loadProject()
  const geminiApiKey = loadGeminiKey()
  setState(s => produce(s, draft => { draft.project = project; draft.geminiApiKey = geminiApiKey }))
  if (restored) showToast('↩ Projet restauré')

  // Init UI
  initPanel()
  bindToolbar()
  bindHeader()
  bindModal()
  bindKeyboard()

  // Init canvas
  const canvas    = document.getElementById('main-canvas') as HTMLCanvasElement
  const container = document.getElementById('canvas-container') as HTMLElement
  setupCanvas(canvas, container)
  initZoom(canvas)

  // Subscribe: re-render + auto-save on every state change
  let rafHandle: number | null = null
  let lastWallId: string | null = null
  subscribe(() => {
    const { project } = getState()
    autoSave(project)
    updateHeaderDisplay()
    // Reset zoom when switching walls
    if (project.activeWallId !== lastWallId) {
      resetZoom()
      lastWallId = project.activeWallId
    }
    if (rafHandle) cancelAnimationFrame(rafHandle)
    rafHandle = requestAnimationFrame(() => {
      const wall = getActiveWall()
      if (wall) renderWithState(canvas, wall, getProject())
    })
  })

  // Initial render
  const wall = getActiveWall()
  if (wall) renderWithState(canvas, wall, getProject())

  // Resize observer
  new ResizeObserver(() => {
    setupCanvas(canvas, container)
    const w = getActiveWall()
    if (w) renderWithState(canvas, w, getProject())
  }).observe(container)
}

// ── Header ───────────────────────────────────────────────────────────────────

function updateHeaderDisplay(): void {
  const el = document.getElementById('project-name-display')
  if (el) el.textContent = getProject().name
}

function bindHeader(): void {
  document.getElementById('btn-add-wall')?.addEventListener('click', () => {
    // Switch to project tab first
    const tabBtn = document.querySelector('[data-tab="project"]') as HTMLElement | null
    tabBtn?.click()
    // Audit fix: lit-html render() is synchronous — btn-new-wall is already in the DOM
    // after tabBtn.click(), no setTimeout needed
    document.getElementById('btn-new-wall')?.click()
  })

  document.getElementById('btn-settings')?.addEventListener('click', showSettingsModal)
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function bindToolbar(): void {
  const canvas = () => document.getElementById('main-canvas') as HTMLCanvasElement

  // PDF — active wall
  document.getElementById('btn-pdf')?.addEventListener('click', async () => {
    const wall = getActiveWall()
    if (!wall) return
    await exportWallPdf(canvas(), getProject(), wall)
  })

  // PDF — all walls
  document.getElementById('btn-pdf-all')?.addEventListener('click', async () => {
    await exportAllWallsPdf(canvas(), getProject())
  })

  // Gemini render
  document.getElementById('btn-gemini')?.addEventListener('click', async () => {
    const wall = getActiveWall()
    if (!wall) return
    const { geminiApiKey, geminiModel } = getState()
    if (!geminiApiKey) { showSettingsModal(); return }

    const overlay = document.getElementById('canvas-overlay')!
    overlay.classList.remove('hidden')
    try {
      const base64 = await generateWallRender(wall, getProject(), geminiApiKey, geminiModel)
      setState(s => produce(s, draft => { draft.geminiLastImage = base64 }))
      showImageModal(base64)
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      overlay.classList.add('hidden')
    }
  })

  // Save
  document.getElementById('btn-save')?.addEventListener('click', () => {
    exportProject(getProject())
  })

  // Import
  document.getElementById('btn-import')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const project = await importProject(file)
      setState(s => produce(s, draft => { draft.project = project }))
      showToast('↩ Projet importé')
    } catch {
      showToast('❌ Fichier invalide', 'error')
    }
  })
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

function bindKeyboard(): void {
  document.addEventListener('keydown', e => {
    // Undo / Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo() }
    // Close modal on Escape
    if (e.key === 'Escape') {
      document.getElementById('app-modal')?.classList.add('hidden')
    }
  })
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function bindModal(): void {
  document.getElementById('modal-close')?.addEventListener('click', () => {
    document.getElementById('app-modal')!.classList.add('hidden')
  })
  document.getElementById('app-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('app-modal')!.classList.add('hidden')
    }
  })
}

function showSettingsModal(): void {
  const { geminiApiKey, geminiModel } = getState()
  // Audit fix: h() escapes geminiApiKey — prevents attribute injection XSS
  // (e.g. a key containing `"` would break value="${geminiApiKey}" without escaping)
  document.getElementById('modal-content')!.innerHTML = `
    <div style="min-width:280px">
      <h3 style="margin-bottom:12px">⚙️ Paramètres</h3>
      <div class="field">
        <label>Clé API Gemini</label>
        <input type="password" id="setting-gemini-key" value="${h(geminiApiKey)}" placeholder="AIza..." style="width:100%" />
        <small style="color:var(--text-muted)">Obtenez votre clé sur <a href="https://aistudio.google.com" target="_blank" style="color:var(--accent)">aistudio.google.com</a></small>
      </div>
      <div class="field">
        <label>Modèle Gemini</label>
        <select id="setting-gemini-model" style="width:100%">
          <option value="gemini-flash" ${geminiModel === 'gemini-flash' ? 'selected' : ''}>Gemini Flash (gratuit)</option>
          <option value="imagen-4"     ${geminiModel === 'imagen-4'     ? 'selected' : ''}>Imagen 4 (haute qualité)</option>
        </select>
      </div>
      <button id="settings-save" class="primary" style="width:100%;margin-top:10px">Enregistrer</button>
    </div>`
  document.getElementById('app-modal')!.classList.remove('hidden')
  document.getElementById('settings-save')?.addEventListener('click', () => {
    const key   = (document.getElementById('setting-gemini-key')   as HTMLInputElement).value
    const model = (document.getElementById('setting-gemini-model') as HTMLSelectElement).value as 'gemini-flash' | 'imagen-4'
    saveGeminiKey(key)
    setState(s => produce(s, draft => { draft.geminiApiKey = key; draft.geminiModel = model }))
    document.getElementById('app-modal')!.classList.add('hidden')
    showToast('✓ Paramètres sauvegardés')
  })
}

function showImageModal(base64: string): void {
  document.getElementById('modal-content')!.innerHTML = `
    <div>
      <h3 style="margin-bottom:12px">🤖 Rendu Gemini</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%;border-radius:6px" />
      <div style="margin-top:10px;display:flex;gap:8px">
        <a href="data:image/png;base64,${base64}" download="rendu-gemini.png" class="btn primary">⬇ Télécharger</a>
      </div>
    </div>`
  document.getElementById('app-modal')!.classList.remove('hidden')
}

// ── Start ─────────────────────────────────────────────────────────────────────
boot()
```

- [ ] **Step 2: Verify full build**

```bash
npm run build
```

Expected: `dist/` folder created, no TypeScript errors.

- [ ] **Step 3: Test locally**

```bash
npm run dev
```

Open `http://localhost:5173/moldures-designer/` — verify:
- Wall renders on canvas
- Side panel tabs work
- Budget updates when changing frame count
- Save/load JSON works

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests PASS (layout + budget + storage).

- [ ] **Step 5: Final commit**

```bash
git add src/index.ts
git commit -m "feat: wire all modules together in index.ts — app complete"
```

---

### Task 18: GitHub deployment

- [ ] **Step 1: Create GitHub repository**

```bash
gh repo create moldures-designer --public --source=. --remote=origin --push
```

Or manually: create repo on GitHub, then:
```bash
git remote add origin https://github.com/<USERNAME>/moldures-designer.git
git push -u origin main
```

- [ ] **Step 2: Enable GitHub Pages in repo settings**

Go to repo Settings → Pages → Source: **GitHub Actions**

- [ ] **Step 3: Verify deployment**

After pushing, watch GitHub Actions tab. On success, app is live at:
`https://<USERNAME>.github.io/moldures-designer/`

- [ ] **Step 4: Final smoke test**

Open the live URL and verify:
- Canvas renders the default wall
- All 6 panel tabs open correctly
- Budget calculates without errors
- Export PDF downloads a file
- Save/Load JSON round-trips correctly

---

## Summary

| Chunk | Tasks | Key deliverables |
|---|---|---|
| 1 | 1 | Vite + TS scaffolding, GitHub Actions |
| 2 | 2–4 | Types, AppState, defaults, storage with tests |
| 3 | 5–6 | Layout engine + budget calculator with tests |
| 4 | 7–10 | Canvas renderer (wall, frames, obstacles, annotations) |
| 5 | 11–14 | HTML shell, CSS, all 6 UI panels |
| 6 | 15–16 | PDF export + Gemini AI service |
| 7 | 17–18 | Integration wiring + GitHub Pages deployment |

**Test coverage:** layout engine, budget calculator, storage/migration (pure functions).
**Manual testing:** canvas rendering, UI interactions, PDF output, Gemini API.
