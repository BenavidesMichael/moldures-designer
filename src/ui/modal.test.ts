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
