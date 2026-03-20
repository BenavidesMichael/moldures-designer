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
