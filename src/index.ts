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

    const overlay = document.getElementById('canvas-overlay')
    if (!overlay) return
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
  const appModal = document.getElementById('app-modal')
  document.getElementById('modal-close')?.addEventListener('click', () => {
    appModal?.classList.add('hidden')
  })
  appModal?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      appModal.classList.add('hidden')
    }
  })
}

function showSettingsModal(): void {
  const { geminiApiKey, geminiModel } = getState()
  const modalContent = document.getElementById('modal-content')
  const appModal = document.getElementById('app-modal')
  if (!modalContent || !appModal) return
  // Audit fix: h() escapes geminiApiKey — prevents attribute injection XSS
  // (e.g. a key containing `"` would break value="${geminiApiKey}" without escaping)
  modalContent.innerHTML = `
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
  appModal.classList.remove('hidden')
  document.getElementById('settings-save')?.addEventListener('click', () => {
    const key   = (document.getElementById('setting-gemini-key')   as HTMLInputElement).value
    const raw   = (document.getElementById('setting-gemini-model') as HTMLSelectElement).value
    const model: 'gemini-flash' | 'imagen-4' = raw === 'imagen-4' ? 'imagen-4' : 'gemini-flash'
    saveGeminiKey(key)
    setState(s => produce(s, draft => { draft.geminiApiKey = key; draft.geminiModel = model }))
    appModal.classList.add('hidden')
    showToast('✓ Paramètres sauvegardés')
  })
}

function showImageModal(base64: string): void {
  const modalContent = document.getElementById('modal-content')
  const appModal = document.getElementById('app-modal')
  if (!modalContent || !appModal) return
  modalContent.innerHTML = `
    <div>
      <h3 style="margin-bottom:12px">🤖 Rendu Gemini</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%;border-radius:6px" />
      <div style="margin-top:10px;display:flex;gap:8px">
        <a href="data:image/png;base64,${base64}" download="rendu-gemini.png" class="btn primary">⬇ Télécharger</a>
      </div>
    </div>`
  appModal.classList.remove('hidden')
}

// ── Start ─────────────────────────────────────────────────────────────────────
boot()
