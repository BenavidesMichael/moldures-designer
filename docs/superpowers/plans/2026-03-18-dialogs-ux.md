# Dialogs UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer tous les `prompt()` et `confirm()` natifs par le système modal custom + toasts avec bouton Annuler.

**Architecture:** Extension rétrocompatible de `showToast` avec paramètre `action?` optionnel (construction DOM impérative, XSS-safe). Nouveau helper `showInputModal` pour toutes les saisies texte simples. Modaux form-spécifiques pour rosette (3 champs) et reset projet (confirm danger). Les suppressions utilisent le pattern "supprimer direct + toast Annuler → undo()".

**Tech Stack:** TypeScript strict, lit-html 3 (`render()`, `html`), immer, vitest + jsdom, nanoid

**Spec:** `docs/superpowers/specs/2026-03-18-dialogs-design.md`

**Amendement de :** `docs/superpowers/plans/2026-03-18-moldures-designer.md` (Tasks 12 et 14)

---

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `src/ui/toast.ts` | Modifier — ajouter `ToastAction`, paramètre `action?`, DOM imperatif |
| `src/ui/modal.ts` | Créer — `showInputModal()` |
| `src/style.css` | Modifier — ajouter `.toast-action` |
| `src/ui/ProjectPanel.ts` | Modifier — `addWall`, `renameWall`, `deleteWall`, `resetProject` |
| `src/ui/MoldingsPanel.ts` | Modifier — `addRosette`, delete molding, delete rosette |
| `src/ui/toast.test.ts` | Créer — tests toast avec action |
| `src/ui/modal.test.ts` | Créer — tests showInputModal |
| `src/ui/MoldingsPanel.test.ts` | Créer — tests showRosetteModal |
| `src/ui/ProjectPanel.test.ts` | Créer — tests showResetConfirmModal |

---

## Chunk 1: Toast + Modal helper

### Task 1: Extend toast.ts

**Files:**
- Modify: `src/ui/toast.ts`
- Modify: `src/style.css`
- Create: `src/ui/toast.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/toast.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { showToast } from './toast.js'

describe('showToast', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app-toast"></div>'
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('affiche le texte via textContent (XSS-safe)', () => {
    showToast('Hello <b>World</b>')
    const span = document.querySelector('.toast-msg') as HTMLElement
    expect(span.textContent).toBe('Hello <b>World</b>')
    expect(span.innerHTML).toBe('Hello &lt;b&gt;World&lt;/b&gt;')
  })

  it('cache le toast après 2.5s sans action', () => {
    showToast('Hello')
    expect(document.getElementById('app-toast')!.classList.contains('app-toast--visible')).toBe(true)
    vi.advanceTimersByTime(2500)
    expect(document.getElementById('app-toast')!.classList.contains('app-toast--visible')).toBe(false)
  })

  it('affiche le bouton action quand action fournie', () => {
    showToast('Supprimé', 'success', { label: 'Annuler', onClick: vi.fn() })
    const btn = document.querySelector('.toast-action') as HTMLButtonElement
    expect(btn).not.toBeNull()
    expect(btn.textContent).toBe('Annuler')
  })

  it('appelle onClick et ferme immédiatement au clic du bouton', () => {
    const onClick = vi.fn()
    showToast('Supprimé', 'success', { label: 'Annuler', onClick })
    const btn = document.querySelector('.toast-action') as HTMLButtonElement
    btn.click()
    expect(onClick).toHaveBeenCalledOnce()
    expect(document.getElementById('app-toast')!.classList.contains('app-toast--visible')).toBe(false)
  })

  it('cache le toast après 4s avec action (pas avant)', () => {
    showToast('Supprimé', 'success', { label: 'Annuler', onClick: vi.fn() })
    vi.advanceTimersByTime(3999)
    expect(document.getElementById('app-toast')!.classList.contains('app-toast--visible')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(document.getElementById('app-toast')!.classList.contains('app-toast--visible')).toBe(false)
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/ui/toast.test.ts
```

Expected: FAIL — `.toast-msg` introuvable, `.toast-action` introuvable.

- [ ] **Step 3: Remplacer le contenu de `src/ui/toast.ts`**

```typescript
export interface ToastAction {
  label: string
  onClick: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(
  message: string,
  type: 'success' | 'error' = 'success',
  action?: ToastAction,
): void {
  const el = document.getElementById('app-toast')
  if (!el) return

  el.innerHTML = ''   // vide le contenu précédent

  const span = document.createElement('span')
  span.className = 'toast-msg'
  span.textContent = message  // textContent — XSS-safe
  el.appendChild(span)

  if (action) {
    const btn = document.createElement('button')
    btn.className = 'toast-action'
    btn.textContent = action.label
    btn.addEventListener('click', () => {
      action.onClick()
      el.classList.remove('app-toast--visible')
      if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
    })
    el.appendChild(btn)
  }

  el.className = `app-toast app-toast--${type} app-toast--visible`
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    el.classList.remove('app-toast--visible')
  }, action ? 4000 : 2500)
}
```

- [ ] **Step 4: Ajouter `.toast-action` dans `src/style.css`**

Ajouter après les règles `.app-toast` existantes :

```css
.toast-action {
  margin-left: 12px;
  background: transparent;
  border: 1px solid currentColor;
  color: inherit;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}
```

- [ ] **Step 5: Vérifier que les tests passent**

```bash
npx vitest run src/ui/toast.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/toast.ts src/ui/toast.test.ts src/style.css
git commit -m "feat: extend showToast with optional action button (Gmail pattern)"
```

---

### Task 2: Créer modal.ts — showInputModal

**Files:**
- Create: `src/ui/modal.ts`
- Create: `src/ui/modal.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/modal.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { showInputModal } from './modal.js'

describe('showInputModal', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app-modal" class="hidden"></div>
      <div id="modal-content"></div>`
  })

  it('ouvre le modal et pré-remplit le champ', () => {
    showInputModal('Nouveau mur', 'Salon', vi.fn())
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(false)
    expect((document.getElementById('modal-input') as HTMLInputElement).value).toBe('Salon')
  })

  it('désactive le bouton OK si le champ est vide ou espaces', () => {
    showInputModal('Test', '', vi.fn())
    const btn = document.getElementById('modal-ok') as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    // Taper des espaces → toujours désactivé
    const input = document.getElementById('modal-input') as HTMLInputElement
    input.value = '   '
    input.dispatchEvent(new Event('input'))
    expect((document.getElementById('modal-ok') as HTMLButtonElement).disabled).toBe(true)
  })

  it('appelle onSave avec la valeur trimée au clic OK', () => {
    const onSave = vi.fn()
    showInputModal('Test', 'Salon ', onSave)
    ;(document.getElementById('modal-ok') as HTMLButtonElement).click()
    expect(onSave).toHaveBeenCalledWith('Salon')
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(true)
  })

  it('soumet via touche Enter si non-vide', () => {
    const onSave = vi.fn()
    showInputModal('Test', 'Salon', onSave)
    const input = document.getElementById('modal-input') as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onSave).toHaveBeenCalledWith('Salon')
  })

  it("ne soumet pas via Enter si le champ est vide", () => {
    const onSave = vi.fn()
    showInputModal('Test', '', onSave)
    const input = document.getElementById('modal-input') as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it("n'appelle pas onSave si le modal est fermé par dismiss (✕ / backdrop)", () => {
    // bindModal() dans index.ts ferme le modal via classList.add('hidden') sans callback
    // Ce test vérifie que showInputModal ne connecte aucun hook sur la fermeture externe
    const onSave = vi.fn()
    showInputModal('Test', 'Salon', onSave)
    // Simuler le dismiss externe (✕ ou backdrop)
    document.getElementById('app-modal')!.classList.add('hidden')
    expect(onSave).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/ui/modal.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Créer `src/ui/modal.ts`**

> `live` est requis sur `.value` pour que lit-html compare contre la vraie valeur DOM (et non
> la valeur du template précédent) — évite la réinitialisation du curseur à chaque frappe.

```typescript
import { html, render } from 'lit-html'
import { live } from 'lit-html/directives/live.js'

export function showInputModal(
  title: string,
  initial: string,
  onSave: (value: string) => void,
): void {
  const content = document.getElementById('modal-content')!
  const modal   = document.getElementById('app-modal')!

  let value = initial

  const close = () => modal.classList.add('hidden')

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSave(trimmed)
    close()
  }

  const renderTpl = () => render(html`
    <div style="min-width:240px">
      <h3 style="margin-bottom:12px">${title}</h3>
      <input
        id="modal-input"
        type="text"
        .value=${live(value)}
        style="width:100%"
        @input=${(e: Event) => { value = (e.target as HTMLInputElement).value; renderTpl() }}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') submit() }}
        autofocus
      />
      <button
        id="modal-ok"
        class="primary"
        style="width:100%;margin-top:10px"
        ?disabled=${!value.trim()}
        @click=${submit}
      >OK</button>
    </div>
  `, content)

  renderTpl()
  modal.classList.remove('hidden')
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npx vitest run src/ui/modal.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/modal.ts src/ui/modal.test.ts
git commit -m "feat: add showInputModal helper for single-field text input"
```

---

## Chunk 2: Panels

### Task 3: Mettre à jour ProjectPanel.ts

**Files:**
- Modify: `src/ui/ProjectPanel.ts`
- Create: `src/ui/ProjectPanel.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/ProjectPanel.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks AVANT l'import du module
vi.mock('../state/AppState.js', () => ({
  getProject: () => ({
    id: 'p1', version: 1, name: 'Test', createdAt: '', activeWallId: 'w1',
    walls: [{ id: 'w1', name: 'Salon', zones: [], obstacles: [], separator: null, dimensions: { width: 400, height: 270 }, margins: { top: 5, bottom: 5, left: 5, right: 5 }, zoneMode: '1zone' }],
    moldings: [], rosettes: [],
  }),
  setState: vi.fn(),
  undo: vi.fn(),
}))
vi.mock('../state/storage.js', () => ({
  exportProject: vi.fn(), importProject: vi.fn(), clearStorage: vi.fn(),
}))
vi.mock('../state/defaults.js', () => ({
  makeDefaultProject: () => ({
    id: 'new', version: 1, name: 'Nouveau', createdAt: '', activeWallId: 'w0',
    walls: [{ id: 'w0', name: 'Mur 1', zones: [], obstacles: [], separator: null, dimensions: { width: 400, height: 270 }, margins: { top: 5, bottom: 5, left: 5, right: 5 }, zoneMode: '1zone' }],
    moldings: [], rosettes: [],
  }),
}))
vi.mock('./toast.js', () => ({ showToast: vi.fn() }))
vi.mock('./modal.js', () => ({ showInputModal: vi.fn() }))

import { showResetConfirmModal } from './ProjectPanel.js'
import { setState } from '../state/AppState.js'
import { clearStorage } from '../state/storage.js'
import { showToast } from './toast.js'

describe('showResetConfirmModal', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app-modal" class="hidden"></div>
      <div id="modal-content"></div>`
    vi.clearAllMocks()
  })

  it('ouvre le modal de confirmation', () => {
    showResetConfirmModal()
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(false)
    expect(document.body.textContent).toContain('Réinitialiser le projet')
  })

  it('clic Annuler ferme le modal sans appeler setState ni clearStorage', () => {
    showResetConfirmModal()
    const btnAnnuler = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Annuler'))!
    btnAnnuler.click()
    expect(setState).not.toHaveBeenCalled()
    expect(clearStorage).not.toHaveBeenCalled()
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(true)
  })

  it('clic Réinitialiser appelle clearStorage + setState + showToast', () => {
    showResetConfirmModal()
    const btnReset = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Réinitialiser'))!
    btnReset.click()
    expect(clearStorage).toHaveBeenCalledOnce()
    expect(setState).toHaveBeenCalledOnce()
    expect(showToast).toHaveBeenCalledWith('🔄 Projet réinitialisé')
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(true)
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/ui/ProjectPanel.test.ts
```

Expected: FAIL — `showResetConfirmModal` not exported.

- [ ] **Step 3: Modifier `src/ui/ProjectPanel.ts`**

**3a. Ajouter les imports manquants** en haut du fichier :

```typescript
import { html, render } from 'lit-html'          // ajouter 'render'
import { nanoid } from 'nanoid'
import { produce } from 'immer'
import { getProject, setState, undo } from '../state/AppState.js'   // ajouter 'undo'
import { exportProject, importProject, clearStorage } from '../state/storage.js'
import { showToast } from './toast.js'
import { showInputModal } from './modal.js'                          // NOUVEAU
import { makeDefaultProject } from '../state/defaults.js'
import type { Wall } from '../types/index.js'
```

**3b. Remplacer `addWall()`** :

```typescript
function addWall(): void {
  showInputModal('Nouveau mur', 'Nouveau mur', name => {
    const wall: Wall = { ...makeDefaultProject().walls[0]!, id: nanoid(), name }
    setState(s => produce(s, draft => {
      draft.project.walls.push(wall)
      draft.project.activeWallId = wall.id
    }))
  })
}
```

**3c. Remplacer `renameWall()`** :

```typescript
function renameWall(id: string, currentName: string): void {
  showInputModal('Renommer le mur', currentName, name => {
    setState(s => produce(s, draft => {
      const w = draft.project.walls.find(w => w.id === id)
      if (w) w.name = name
    }))
  })
}
```

**3d. Remplacer `deleteWall()`** :

```typescript
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
```

**3e. Remplacer `resetProject()` et ajouter `showResetConfirmModal()`** :

```typescript
function resetProject(): void {
  showResetConfirmModal()
}

/** @internal — exported for tests only */
export function showResetConfirmModal(): void {
  render(html`
    <div style="min-width:280px">
      <h3 style="margin-bottom:12px">⚠ Réinitialiser le projet ?</h3>
      <p style="color:var(--text-muted);margin-bottom:16px">
        Toutes les données seront perdues.<br/>
        Cette action peut être annulée avec Ctrl+Z.
      </p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button @click=${() => document.getElementById('app-modal')!.classList.add('hidden')}>
          Annuler
        </button>
        <button class="danger" @click=${() => {
          clearStorage()
          setState(s => produce(s, draft => { draft.project = makeDefaultProject() }))
          document.getElementById('app-modal')!.classList.add('hidden')
          showToast('🔄 Projet réinitialisé')
        }}>
          Réinitialiser →
        </button>
      </div>
    </div>
  `, document.getElementById('modal-content')!)
  document.getElementById('app-modal')!.classList.remove('hidden')
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npx vitest run src/ui/ProjectPanel.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ProjectPanel.ts src/ui/ProjectPanel.test.ts
git commit -m "feat: replace prompt/confirm in ProjectPanel with modal and toast+undo"
```

---

### Task 4: Mettre à jour MoldingsPanel.ts

**Files:**
- Modify: `src/ui/MoldingsPanel.ts`
- Create: `src/ui/MoldingsPanel.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/MoldingsPanel.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as litRender } from 'lit-html'

// ── Mocks — doivent être AVANT les imports du module sous test ────────────────
vi.mock('../state/AppState.js', () => ({
  getProject: vi.fn(() => ({
    id: 'p1', version: 1, name: 'Test', createdAt: '', activeWallId: 'w1',
    walls: [], moldings: [], rosettes: [],
  })),
  setState: vi.fn(),
  undo:     vi.fn(),
}))
vi.mock('./toast.js',  () => ({ showToast: vi.fn() }))
vi.mock('nanoid',      () => ({ nanoid: () => 'test-id-123' }))

import { showRosetteModal, MoldingsPanel } from './MoldingsPanel.js'
import { getProject, setState, undo } from '../state/AppState.js'
import { showToast } from './toast.js'

// ── Données de test ───────────────────────────────────────────────────────────
const emptyProject = {
  id: 'p1', version: 1, name: 'Test', createdAt: '', activeWallId: 'w1',
  walls: [], moldings: [], rosettes: [],
}
const richProject = {
  ...emptyProject,
  moldings: [{ id: 'm1', name: 'Médaillon', reference: '', width: 16, thickness: 29, barLength: 270, pricePerBar: 12, color: '#fff' }],
  rosettes: [{ id: 'r1', name: 'Haussmann', reference: '', size: 20.5, pricePerPiece: 9.68 }],
}

// ── showRosetteModal ──────────────────────────────────────────────────────────
describe('showRosetteModal', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app-modal" class="hidden"></div>
      <div id="modal-content"></div>`
    vi.clearAllMocks()  // AVANT mockReturnValue — clearAllMocks() réinitialise aussi les valeurs de retour
    vi.mocked(getProject).mockReturnValue(emptyProject as never)
  })

  it('ouvre le modal', () => {
    showRosetteModal()
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(false)
  })

  it('désactive Enregistrer quand le nom est vide', () => {
    showRosetteModal()
    expect((document.getElementById('ros-save') as HTMLButtonElement).disabled).toBe(true)
  })

  it('désactive Enregistrer quand la taille est 0 (avec nom valide)', () => {
    showRosetteModal()
    // Nom valide d'abord — pour isoler la condition taille
    const nameInput = document.getElementById('ros-name') as HTMLInputElement
    nameInput.value = 'Haussmann'
    nameInput.dispatchEvent(new Event('input'))
    // Taille = 0 → bouton doit rester désactivé à cause de la condition taille
    const sizeInput = document.getElementById('ros-size') as HTMLInputElement
    sizeInput.value = '0'
    sizeInput.dispatchEvent(new Event('input'))
    expect((document.getElementById('ros-save') as HTMLButtonElement).disabled).toBe(true)
  })

  it('accepte prix = 0 (bouton actif si nom et taille valides)', () => {
    showRosetteModal()
    const nameInput = document.getElementById('ros-name') as HTMLInputElement
    nameInput.value = 'Haussmann'
    nameInput.dispatchEvent(new Event('input'))
    // Taille explicitement valide (ne pas dépendre de la valeur par défaut)
    const sizeInput = document.getElementById('ros-size') as HTMLInputElement
    sizeInput.value = '22'
    sizeInput.dispatchEvent(new Event('input'))
    const priceInput = document.getElementById('ros-price') as HTMLInputElement
    priceInput.value = '0'
    priceInput.dispatchEvent(new Event('input'))
    expect((document.getElementById('ros-save') as HTMLButtonElement).disabled).toBe(false)
  })

  it('appelle setState avec les bonnes valeurs au submit', () => {
    showRosetteModal()
    const nameInput = document.getElementById('ros-name') as HTMLInputElement
    nameInput.value = 'Haussmann'
    nameInput.dispatchEvent(new Event('input'))
    const sizeInput = document.getElementById('ros-size') as HTMLInputElement
    sizeInput.value = '22'
    sizeInput.dispatchEvent(new Event('input'))
    ;(document.getElementById('ros-save') as HTMLButtonElement).click()
    expect(setState).toHaveBeenCalledOnce()
    // Exécuter le producer immer pour inspecter la rosette créée.
    // produce() retourne un NOUVEL objet — capturer le résultat (ne pas muter draft en place)
    const producer = vi.mocked(setState).mock.calls[0]![0]
    const base = { project: { rosettes: [] as unknown[] } }
    const result = producer(base as never) as typeof base
    expect(result.project.rosettes).toHaveLength(1)
    expect((result.project.rosettes[0] as Record<string, unknown>)['name']).toBe('Haussmann')
    expect((result.project.rosettes[0] as Record<string, unknown>)['size']).toBe(22)
    expect((result.project.rosettes[0] as Record<string, unknown>)['id']).toBe('test-id-123')
  })
})

// ── Delete handlers ───────────────────────────────────────────────────────────
describe('delete handlers — toast + undo', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="panel-content"></div>
      <div id="app-modal" class="hidden"></div>
      <div id="modal-content"></div>`
    vi.clearAllMocks()  // AVANT mockReturnValue — clearAllMocks() réinitialise aussi les valeurs de retour
    vi.mocked(getProject).mockReturnValue(richProject as never)  // richProject requis par MoldingsPanel()
  })

  it('delete molding : appelle setState + showToast avec Annuler→undo', () => {
    const container = document.getElementById('panel-content')!
    litRender(MoldingsPanel(), container)
    // Premier bouton .danger = suppression de la moulure
    const delBtn = container.querySelectorAll('.danger')[0] as HTMLButtonElement
    delBtn.click()
    expect(setState).toHaveBeenCalledOnce()
    expect(vi.mocked(showToast)).toHaveBeenCalledWith(
      'Moulure "Médaillon" supprimée', 'success',
      expect.objectContaining({ label: 'Annuler', onClick: undo }),
    )
  })

  it('delete rosette : appelle setState + showToast avec Annuler→undo', () => {
    const container = document.getElementById('panel-content')!
    litRender(MoldingsPanel(), container)
    // Dernier bouton .danger = suppression de la rosette
    const delBtns = container.querySelectorAll('.danger')
    ;(delBtns[delBtns.length - 1] as HTMLButtonElement).click()
    expect(setState).toHaveBeenCalledOnce()
    expect(vi.mocked(showToast)).toHaveBeenCalledWith(
      'Rosette "Haussmann" supprimée', 'success',
      expect.objectContaining({ label: 'Annuler', onClick: undo }),
    )
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/ui/MoldingsPanel.test.ts
```

Expected: FAIL — `showRosetteModal` not exported.

- [ ] **Step 3: Modifier `src/ui/MoldingsPanel.ts`**

**3a. Ajouter les imports manquants** :

```typescript
import { produce } from 'immer'
import { html, render } from 'lit-html'
import type { TemplateResult } from 'lit-html'  // déjà présent — garder (utilisé par MoldingsPanel(): TemplateResult)
import { nanoid } from 'nanoid'
import { getProject, setState, undo } from '../state/AppState.js'   // ajouter 'undo'
import { showToast } from './toast.js'                               // NOUVEAU
import type { Molding, Rosette } from '../types/index.js'
```

**3b. Remplacer `addRosette()` par `showRosetteModal()`** :

Supprimer la fonction `addRosette()` existante. La remplacer par :

```typescript
/** @internal — exported for tests only */
export function showRosetteModal(): void {
  let rosName  = ''
  let rosSize  = 20.5
  let rosPrice = 9.68

  const submit = () => {
    if (!rosName.trim() || rosSize <= 0) return
    const r: Rosette = {
      id: nanoid(),
      name: rosName.trim(),
      reference: '',
      size: rosSize,
      pricePerPiece: rosPrice,
    }
    setState(s => produce(s, draft => { draft.project.rosettes.push(r) }))
    document.getElementById('app-modal')!.classList.add('hidden')
  }

  const renderTpl = () => render(html`
    <div style="min-width:240px">
      <h3 style="margin-bottom:12px">Nouvelle rosette</h3>
      <div class="field">
        <label>Nom</label>
        <input id="ros-name" type="text" .value=${rosName}
               @input=${(e: Event) => { rosName = (e.target as HTMLInputElement).value; renderTpl() }} />
      </div>
      <div class="field">
        <label>Taille (cm)</label>
        <input id="ros-size" type="number" .value=${String(rosSize)} min="0.1" step="0.5"
               @input=${(e: Event) => { rosSize = Number((e.target as HTMLInputElement).value); renderTpl() }} />
      </div>
      <div class="field">
        <label>Prix/pièce (€)</label>
        <input id="ros-price" type="number" .value=${String(rosPrice)} min="0" step="0.01"
               @input=${(e: Event) => { rosPrice = Number((e.target as HTMLInputElement).value); renderTpl() }} />
      </div>
      <button id="ros-save" class="primary" style="width:100%;margin-top:10px"
              ?disabled=${!rosName.trim() || rosSize <= 0}
              @click=${submit}>Enregistrer</button>
    </div>
  `, document.getElementById('modal-content')!)

  renderTpl()
  document.getElementById('app-modal')!.classList.remove('hidden')
}
```

**3c. Mettre à jour le bouton "Ajouter rosette"** dans `MoldingsPanel()` :

```typescript
<button style="width:100%;margin-top:6px" @click=${showRosetteModal}>+ Ajouter rosette</button>
```

**3d. Remplacer le handler delete molding** (dans `MoldingsPanel()`, la liste des moulures) :

Avant :
```typescript
<button class="danger" @click=${() => {
  if (!confirm('Supprimer cette moulure ?')) return
  setState(s => produce(s, draft => {
    draft.project.moldings = draft.project.moldings.filter(x => x.id !== m.id)
  }))
}}>🗑️</button>
```

Après :
```typescript
<button class="danger" @click=${() => {
  const moldingName = m.name
  setState(s => produce(s, draft => {
    draft.project.moldings = draft.project.moldings.filter(x => x.id !== m.id)
  }))
  showToast(`Moulure "${moldingName}" supprimée`, 'success', { label: 'Annuler', onClick: undo })
}}>🗑️</button>
```

**3e. Remplacer le handler delete rosette** (dans `MoldingsPanel()`, la liste des rosettes) :

Avant :
```typescript
<button class="danger" @click=${() => setState(s => produce(s, draft => {
  draft.project.rosettes = draft.project.rosettes.filter(x => x.id !== r.id)
}))}>🗑️</button>
```

Après :
```typescript
<button class="danger" @click=${() => {
  const rosetteName = r.name
  setState(s => produce(s, draft => {
    draft.project.rosettes = draft.project.rosettes.filter(x => x.id !== r.id)
  }))
  showToast(`Rosette "${rosetteName}" supprimée`, 'success', { label: 'Annuler', onClick: undo })
}}>🗑️</button>
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npx vitest run src/ui/MoldingsPanel.test.ts
```

Expected: 7 tests PASS (5 dans `showRosetteModal` + 2 dans `delete handlers`).

- [ ] **Step 5: Lancer tous les tests**

```bash
npx vitest run
```

Expected: tous les tests PASS (zéro régression).

- [ ] **Step 6: Commit**

```bash
git add src/ui/MoldingsPanel.ts src/ui/MoldingsPanel.test.ts
git commit -m "feat: replace prompt/confirm in MoldingsPanel with modal form and toast+undo"
```

---

## Chunk 3: Vérification finale

### Task 5: Smoke test manuel + build

**Files:** aucun

- [ ] **Step 1: Build de production**

```bash
npm run build
```

Expected: `dist/` généré, zéro erreur TypeScript.

- [ ] **Step 2: Démarrer le serveur de dev**

```bash
npm run dev
```

Ouvrir `http://localhost:5173` et vérifier manuellement :

| Action | Résultat attendu |
|--------|-----------------|
| Clic "+ Ajouter un mur" | Modal custom s'ouvre avec un champ texte pré-rempli "Nouveau mur" |
| Clic ✏️ sur un mur | Modal s'ouvre avec le nom actuel |
| Bouton OK vide | Désactivé (grisé) |
| Supprimer un mur | Toast "Mur X supprimé [Annuler]" pendant 4s — clic Annuler restaure |
| Clic "Réinitialiser" | Modal de confirmation avec boutons Annuler / Réinitialiser → |
| Clic "Annuler" dans reset | Ferme sans changer les données |
| "+ Ajouter moulure" (✏️ edit) | Modal avec champs pré-remplis |
| Supprimer une moulure | Toast "Moulure X supprimée [Annuler]" — undo fonctionne |
| "+ Ajouter rosette" | Modal 3 champs, bouton désactivé si nom vide |
| Supprimer une rosette | Toast "Rosette X supprimée [Annuler]" |
| Ctrl+Z après delete | Restaure l'élément supprimé |

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "chore: verify dialogs UX implementation complete"
```
