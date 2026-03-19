import type { Project } from '../types/index.js'
import { ProjectSchema } from '../types/schemas.js'
import { makeDefaultProject, makeDefaultZone } from './defaults.js'
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
  // Ensure raw is an object
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid project file')
  }

  const obj = raw as Record<string, unknown>

  // Ensure required base fields exist
  if (!obj.id || !obj.name || !obj.createdAt || !obj.activeWallId) {
    throw new Error('Invalid project file')
  }

  // Provide default version if missing
  const withDefaults = {
    ...obj,
    version: obj.version ?? 1,
  }

  // If walls are missing or empty, provide a minimal default wall structure
  if (!withDefaults.walls || (Array.isArray(withDefaults.walls) && withDefaults.walls.length === 0)) {
    withDefaults.walls = [{
      id: obj.activeWallId,
      name: 'Mur',
      dimensions: { width: 300, height: 250, plinthHeight: 10 },
      zoneMode: '1zone',
      zones: [makeDefaultZone('full', 1)],
      obstacles: [],
      colors: { wall: '#f5f0e8', moldings: '', plinth: '#ffffff' },
      showAnnotations: true,
    }]
  }

  // zod valide le schéma complet et retourne des types corrects
  // safeParse ne lève pas d'exception — on gère l'erreur explicitement
  const result = ProjectSchema.safeParse(withDefaults)
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
