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
