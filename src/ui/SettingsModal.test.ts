import { describe, it, expect, vi, beforeEach } from 'vitest'
import { produce } from 'immer'

vi.mock('../state/AppState.js', () => ({
  getState: vi.fn(() => ({ geminiApiKey: 'key-test', geminiModel: 'gemini-flash' })),
  setState: vi.fn(fn => fn({ geminiApiKey: '', geminiModel: 'gemini-flash', project: {} as any })),
}))
vi.mock('../state/storage.js', () => ({ saveGeminiKey: vi.fn() }))
vi.mock('./toast.js', () => ({ showToast: vi.fn() }))

import { showSettingsModal } from './SettingsModal.js'
import { getState, setState } from '../state/AppState.js'
import { saveGeminiKey } from '../state/storage.js'
import { showToast } from './toast.js'

function setupDOM(): void {
  document.body.innerHTML = `
    <div id="app-modal" class="hidden"></div>
    <div id="modal-content"></div>`
}

describe('showSettingsModal', () => {
  beforeEach(() => {
    setupDOM()
    vi.clearAllMocks()
  })

  it('ouvre le modal', () => {
    showSettingsModal()
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(false)
  })

  it('affiche la clé API existante dans le champ password', () => {
    showSettingsModal()
    const input = document.getElementById('setting-gemini-key') as HTMLInputElement
    expect(input.value).toBe('key-test')
  })

  it('sauvegarde la clé API et le modèle au clic Enregistrer', () => {
    showSettingsModal()
    const keyInput = document.getElementById('setting-gemini-key') as HTMLInputElement
    keyInput.value = 'new-key-456'
    const modelSelect = document.getElementById('setting-gemini-model') as HTMLSelectElement
    modelSelect.value = 'imagen-4'

    document.getElementById('settings-save')?.click()

    expect(saveGeminiKey).toHaveBeenCalledWith('new-key-456')
    expect(setState).toHaveBeenCalledOnce()
    // Verify the updater writes the correct payload
    const [updaterFn] = vi.mocked(setState).mock.calls[0]
    const prev = { geminiApiKey: '', geminiModel: 'gemini-flash' as 'gemini-flash' | 'imagen-4' }
    expect(updaterFn(prev)).toMatchObject({ geminiApiKey: 'new-key-456', geminiModel: 'imagen-4' })
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('sauvegardés'))
  })

  it('ferme le modal après sauvegarde', () => {
    showSettingsModal()
    document.getElementById('settings-save')?.click()
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(true)
  })

  it('le sélecteur de modèle Gemini est présent avec la valeur correcte', () => {
    showSettingsModal()
    const select = document.getElementById('setting-gemini-model') as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(select.value).toBe('gemini-flash')
  })

  it('sans GIS disponible — le champ clé API fonctionne normalement', () => {
    // Ensure google is not defined (jsdom default)
    showSettingsModal()
    const input = document.getElementById('setting-gemini-key') as HTMLInputElement
    expect(input).not.toBeNull()
    // GOOGLE_CLIENT_ID = '' → no Google Sign-In button rendered
    expect(document.getElementById('google-signin-btn')).toBeNull()
  })
})
