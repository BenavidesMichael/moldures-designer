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
