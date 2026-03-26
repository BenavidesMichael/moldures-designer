import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/gemini.js', () => ({
  extractMoldingFromText: vi.fn(),
}))
vi.mock('../state/AppState.js', () => ({
  getState: vi.fn(() => ({ geminiApiKey: 'AIza-test', geminiModel: 'gemini-flash' })),
}))
vi.mock('./toast.js', () => ({ showToast: vi.fn() }))

import { showImportModal } from './ImportModal.js'
import { extractMoldingFromText } from '../services/gemini.js'
import { showToast } from './toast.js'

function setupDOM(): void {
  document.body.innerHTML = `
    <div id="app-modal" class="hidden"></div>
    <div id="modal-content"></div>`
}

describe('showImportModal', () => {
  beforeEach(() => {
    setupDOM()
    vi.clearAllMocks()
  })

  it('ouvre le modal', () => {
    showImportModal(vi.fn())
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(false)
  })

  it('bouton Extraire désactivé quand le texte est vide', () => {
    showImportModal(vi.fn())
    const btn = document.querySelector<HTMLButtonElement>('button[disabled]')
    expect(btn).not.toBeNull()
  })

  it('URL invalide — message d\'erreur affiché, extraction toujours possible si texte présent', async () => {
    const onExtracted = vi.fn()
    vi.mocked(extractMoldingFromText).mockResolvedValue({ name: 'Test' })

    showImportModal(onExtracted)

    // Enter invalid URL
    const urlInput = document.getElementById('import-url') as HTMLInputElement
    urlInput.value = 'javascript:alert(1)'
    urlInput.dispatchEvent(new Event('input'))

    // Error message should be visible
    expect(document.body.textContent).toContain('invalide')

    // Extraction button should be enabled if text is present
    const textArea = document.getElementById('import-text') as HTMLTextAreaElement
    textArea.value = 'Moulure bois 16x29mm'
    textArea.dispatchEvent(new Event('input'))

    const btn = document.getElementById('import-extract-btn') as HTMLButtonElement | null
    expect(btn).not.toBeNull()
    expect(btn!.disabled).toBe(false)  // button enabled despite invalid URL
  })

  it('extraction réussie — onExtracted appelé avec les données + URL valide', async () => {
    const onExtracted = vi.fn()
    // Simulate real behavior: function receives url param and attaches it
    vi.mocked(extractMoldingFromText).mockImplementation(async (_t, _k, url) =>
      ({ name: 'Moulure Test', width: 16, ...(url ? { purchaseUrl: url } : {}) }),
    )

    showImportModal(onExtracted)

    const urlInput = document.getElementById('import-url') as HTMLInputElement
    urlInput.value = 'https://amazon.fr/dp/B123'
    urlInput.dispatchEvent(new Event('input'))

    const textArea = document.getElementById('import-text') as HTMLTextAreaElement
    textArea.value = 'Moulure bois 16x29mm 270cm'
    textArea.dispatchEvent(new Event('input'))

    const btn = document.getElementById('import-extract-btn') as HTMLButtonElement
    btn.click()  // click() returns void — no await

    // Wait for async extraction
    await vi.waitFor(() => expect(onExtracted).toHaveBeenCalledOnce())
    expect(onExtracted).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Moulure Test', purchaseUrl: 'https://amazon.fr/dp/B123' }),
    )
  })

  it('URL invalide — purchaseUrl absent de onExtracted', async () => {
    const onExtracted = vi.fn()
    vi.mocked(extractMoldingFromText).mockResolvedValue({ name: 'Test' })

    showImportModal(onExtracted)

    const urlInput = document.getElementById('import-url') as HTMLInputElement
    urlInput.value = 'javascript:alert(1)'
    urlInput.dispatchEvent(new Event('input'))

    const textArea = document.getElementById('import-text') as HTMLTextAreaElement
    textArea.value = 'fiche produit'
    textArea.dispatchEvent(new Event('input'))

    document.getElementById('import-extract-btn')!.click()

    await vi.waitFor(() => expect(onExtracted).toHaveBeenCalledOnce())
    // Invalid URL must not reach extractMoldingFromText — ImportModal passes undefined
    expect(extractMoldingFromText).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), undefined,
    )
    expect(onExtracted.mock.calls[0][0]).not.toHaveProperty('purchaseUrl')
  })

  it('échec d\'extraction — showToast erreur, modal reste ouvert', async () => {
    vi.mocked(extractMoldingFromText).mockRejectedValue(new Error('Extraction échouée'))

    showImportModal(vi.fn())

    const textArea = document.getElementById('import-text') as HTMLTextAreaElement
    textArea.value = 'texte'
    textArea.dispatchEvent(new Event('input'))

    const btn = document.getElementById('import-extract-btn') as HTMLButtonElement
    btn.click()  // click() returns void — no await

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Extraction échouée'), 'error',
    ))
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(false)
  })
})
