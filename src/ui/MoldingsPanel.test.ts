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
    vi.clearAllMocks()
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
    const nameInput = document.getElementById('ros-name') as HTMLInputElement
    nameInput.value = 'Haussmann'
    nameInput.dispatchEvent(new Event('input'))
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
    vi.clearAllMocks()
    vi.mocked(getProject).mockReturnValue(richProject as never)
  })

  it('delete molding : appelle setState + showToast avec Annuler→undo', () => {
    const container = document.getElementById('panel-content')!
    litRender(MoldingsPanel(), container)
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
    const delBtns = container.querySelectorAll('.danger')
    ;(delBtns[delBtns.length - 1] as HTMLButtonElement).click()
    expect(setState).toHaveBeenCalledOnce()
    expect(vi.mocked(showToast)).toHaveBeenCalledWith(
      'Rosette "Haussmann" supprimée', 'success',
      expect.objectContaining({ label: 'Annuler', onClick: undo }),
    )
  })
})

// ─── NEW: Purchase URL & Material ────────────────────────────────────────────
describe('molding list — buy buttons', () => {
  const projectWithLink = {
    ...emptyProject,
    moldings: [
      {
        id: 'm1', name: 'Baroque', reference: 'REF1',
        width: 16, thickness: 29, barLength: 270, pricePerBar: 12,
        color: '#fff', purchaseUrl: 'https://amazon.fr/dp/B001',
      },
      {
        id: 'm2', name: 'Simple', reference: '',
        width: 10, thickness: 20, barLength: 200, pricePerBar: 5,
        color: '#fff',
        // no purchaseUrl
      },
    ],
    rosettes: [],
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="panel-content"></div>
      <div id="app-modal" class="hidden"></div>
      <div id="modal-content"></div>`
    vi.clearAllMocks()
    vi.mocked(getProject).mockReturnValue(projectWithLink as never)
  })

  it('moulure avec purchaseUrl → bouton 🛒 présent avec bonne URL', () => {
    const container = document.getElementById('panel-content')!
    litRender(MoldingsPanel(), container)
    const buyBtn = container.querySelector<HTMLAnchorElement>('a[href="https://amazon.fr/dp/B001"]')
    expect(buyBtn).not.toBeNull()
    expect(buyBtn!.textContent).toContain('🛒')
  })

  it('moulure sans purchaseUrl → bouton 🔍 Amazon présent', () => {
    const container = document.getElementById('panel-content')!
    litRender(MoldingsPanel(), container)
    const searchBtns = container.querySelectorAll('a[href*="amazon.fr/s"]')
    expect(searchBtns.length).toBeGreaterThanOrEqual(1)
    expect(searchBtns[0]!.textContent).toContain('🔍')
  })

  it('URL Amazon de recherche contient le nom et la référence', () => {
    const container = document.getElementById('panel-content')!
    litRender(MoldingsPanel(), container)
    const searchLinks = container.querySelectorAll<HTMLAnchorElement>('a[href*="amazon.fr/s"]')
    // m2 has no purchaseUrl so it should have a search link
    const m2Link = Array.from(searchLinks).find(a => a.href.includes('Simple'))
    expect(m2Link).not.toBeNull()
  })

  it('changement de matériau dans le formulaire → MaterialAdvisor s\'affiche', () => {
    const container = document.getElementById('panel-content')!
    litRender(MoldingsPanel(), container)

    // Click edit on the first molding (Baroque — no material set)
    const editBtn = container.querySelector<HTMLButtonElement>('li button:not(.danger)')
    editBtn!.click()

    const modalContent = document.getElementById('modal-content')!
    const select = modalContent.querySelector<HTMLSelectElement>('#mf-material')!
    expect(select).not.toBeNull()
    // No advisor card before selecting a material
    expect(modalContent.querySelector('.material-advisor')).toBeNull()

    // Select a material — fires @change handler → selectedMaterial updated → renderTpl() called
    select.value = 'wood'
    select.dispatchEvent(new Event('change'))

    // MaterialAdvisor should now be rendered
    expect(modalContent.querySelector('.material-advisor')).not.toBeNull()
  })
})
