import { html, render } from 'lit-html'
import { extractMoldingFromText } from '../services/gemini.js'
import { getState } from '../state/AppState.js'
import { showToast } from './toast.js'
import { PURCHASE_URL_RE } from '../types/schemas.js'
import type { Molding } from '../types/index.js'

export function showImportModal(onExtracted: (data: Partial<Molding>) => void): void {
  let text = ''
  let url = ''
  let urlError = ''
  let loading = false

  const modal = document.getElementById('app-modal')
  const content = document.getElementById('modal-content')
  if (!modal || !content) return

  const renderTpl = () => render(html`
    <div style="min-width:300px">
      <h3 style="margin-bottom:12px">⬇ Importer depuis fiche produit</h3>

      <div class="field">
        <label>Lien produit (optionnel)</label>
        <input type="text" id="import-url"
               .value=${url}
               placeholder="https://amazon.fr/dp/…"
               @input=${(e: Event) => {
                 url = (e.target as HTMLInputElement).value.trim()
                 urlError = url && !PURCHASE_URL_RE.test(url)
                   ? 'URL invalide — doit commencer par https:// ou http://'
                   : ''
                 renderTpl()
               }} />
        ${urlError ? html`<small style="color:var(--error,#c0392b)">${urlError}</small>` : ''}
      </div>

      <div class="field">
        <label>Texte de la fiche produit *</label>
        <textarea id="import-text" rows="6"
                  style="width:100%;resize:vertical;box-sizing:border-box"
                  placeholder="Collez ici le titre + la description + les dimensions copiés depuis la page produit…"
                  @input=${(e: Event) => { text = (e.target as HTMLTextAreaElement).value; renderTpl() }}
                  .value=${text}></textarea>
      </div>

      <button id="import-extract-btn" class="primary" style="width:100%;margin-top:10px"
              ?disabled=${!text.trim() || loading}
              @click=${handleExtract}>
        ${loading ? '⏳ Extraction en cours…' : '✨ Extraire avec Gemini'}
      </button>
    </div>
  `, content)

  const handleExtract = async (): Promise<void> => {
    loading = true
    renderTpl()

    const { geminiApiKey } = getState()
    try {
      // Filter invalid URL before passing — only valid https/http URLs reach the service
      const validUrl = url && PURCHASE_URL_RE.test(url) ? url : undefined
      const result = await extractMoldingFromText(text, geminiApiKey, validUrl)
      // Do NOT close modal — onExtracted replaces #modal-content with the molding form
      onExtracted(result)
    } catch (err) {
      showToast((err as Error).message, 'error')
      loading = false
      renderTpl()
    }
  }

  renderTpl()
  modal.classList.remove('hidden')
}
