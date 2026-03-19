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
