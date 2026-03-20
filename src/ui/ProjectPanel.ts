import { html, render } from 'lit-html'
import { nanoid } from 'nanoid'
import { produce } from 'immer'
import { getProject, setState, undo } from '../state/AppState.js'
import { exportProject, importProject, clearStorage } from '../state/storage.js'
import { showToast } from './toast.js'
import { showInputModal } from './modal.js'
import { makeDefaultProject } from '../state/defaults.js'
import type { Wall } from '../types/index.js'

// Events inlinés dans le template — pas besoin de registerPanelEvents

function addWall(): void {
  showInputModal('Nouveau mur', 'Nouveau mur', name => {
    const wall: Wall = { ...makeDefaultProject().walls[0]!, id: nanoid(), name }
    setState(s => produce(s, draft => {
      draft.project.walls.push(wall)
      draft.project.activeWallId = wall.id
    }))
  })
}

function renameWall(id: string, currentName: string): void {
  showInputModal('Renommer le mur', currentName, name => {
    setState(s => produce(s, draft => {
      const w = draft.project.walls.find(w => w.id === id)
      if (w) w.name = name
    }))
  })
}

function duplicateWall(id: string): void {
  const project = getProject()
  const wall = project.walls.find(w => w.id === id)
  if (!wall) return
  const copy: Wall = { ...wall, id: nanoid(), name: wall.name + ' (copie)' }
  setState(s => produce(s, draft => {
    draft.project.walls.push(copy)
    draft.project.activeWallId = copy.id
  }))
}

function deleteWall(id: string): void {
  const wallName = getProject().walls.find(w => w.id === id)?.name ?? 'Mur'
  setState(s => produce(s, draft => {
    const remaining = draft.project.walls.filter(w => w.id !== id)
    draft.project.walls = remaining.length > 0 ? remaining : makeDefaultProject().walls
    if (!draft.project.walls.some(w => w.id === draft.project.activeWallId)) {
      draft.project.activeWallId = draft.project.walls[0]!.id
    }
  }))
  showToast(`Mur "${wallName}" supprimé`, 'success', { label: 'Annuler', onClick: undo })
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
  showResetConfirmModal()
}

/** @internal — exported for tests only */
export function showResetConfirmModal(): void {
  const content = document.getElementById('modal-content')
  const modal = document.getElementById('app-modal')
  if (!content || !modal) return

  render(html`
    <div style="min-width:280px">
      <h3 style="margin-bottom:12px">⚠ Réinitialiser le projet ?</h3>
      <p style="color:var(--text-muted);margin-bottom:16px">
        Toutes les données seront perdues.<br/>
        Cette action peut être annulée avec Ctrl+Z.
      </p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button @click=${() => modal.classList.add('hidden')}>
          Annuler
        </button>
        <button class="danger" @click=${() => {
          clearStorage()
          setState(s => produce(s, draft => { draft.project = makeDefaultProject() }))
          modal.classList.add('hidden')
          showToast('🔄 Projet réinitialisé')
        }}>
          Réinitialiser →
        </button>
      </div>
    </div>
  `, content)
  modal.classList.remove('hidden')
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
