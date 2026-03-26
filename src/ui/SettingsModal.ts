import { html, render } from 'lit-html'
import type { TemplateResult } from 'lit-html'
import { produce } from 'immer'
import { getState, setState } from '../state/AppState.js'
import { saveGeminiKey } from '../state/storage.js'
import { showToast } from './toast.js'

// Public OAuth 2.0 client ID — non-secret, safe to commit.
// Create yours at console.cloud.google.com → APIs & Services → Credentials
// Add JavaScript origins: http://localhost:5173 and https://<username>.github.io
const GOOGLE_CLIENT_ID = ''  // ← paste your client ID here

interface GoogleUser {
  name: string
  email: string
  picture?: string
}

// Persisted across modal open/close in the same page session
let googleUser: GoogleUser | null = null

export function showSettingsModal(): void {
  const modalContent = document.getElementById('modal-content')
  const appModal = document.getElementById('app-modal')
  if (!modalContent || !appModal) return

  const renderTpl = (): void => {
    // Re-read state on every render so re-opened modal always shows current values
    const { geminiApiKey, geminiModel } = getState()
    render(buildTpl(geminiApiKey, geminiModel, appModal, renderTpl), modalContent)
  }

  renderTpl()
  appModal.classList.remove('hidden')

  // Attempt to render Google Sign-In button (silently fails if GIS not loaded)
  initGoogleSignIn(renderTpl)
}

function buildTpl(
  apiKey: string,
  model: string,
  appModal: HTMLElement,
  renderTpl: () => void,
): TemplateResult {
  const handleSave = (): void => {
    const key   = (document.getElementById('setting-gemini-key')   as HTMLInputElement).value
    const raw   = (document.getElementById('setting-gemini-model') as HTMLSelectElement).value
    const m: 'gemini-flash' | 'imagen-4' = raw === 'imagen-4' ? 'imagen-4' : 'gemini-flash'
    saveGeminiKey(key)
    setState(s => produce(s, draft => { draft.geminiApiKey = key; draft.geminiModel = m }))
    appModal.classList.add('hidden')
    showToast('✓ Paramètres sauvegardés')
  }

  const handleSignOut = (): void => {
    googleUser = null
    renderTpl()
  }

  return html`
    <div style="min-width:280px">
      <h3 style="margin-bottom:12px">⚙️ Paramètres</h3>

      ${googleUser ? html`
        <div class="google-profile">
          ${googleUser.picture ? html`<img src=${googleUser.picture} class="google-avatar" alt="" />` : ''}
          <div class="google-profile__info">
            <div class="google-profile__name">${googleUser.name}</div>
            <div class="google-profile__email">${googleUser.email}</div>
          </div>
          <button @click=${handleSignOut}>Se déconnecter</button>
        </div>
        ` : GOOGLE_CLIENT_ID ? html`
        <div id="google-signin-btn"></div>
        <div class="settings-separator">── ou ──</div>
        ` : ''}

      <div class="field">
        <label>Clé API Gemini</label>
        ${!apiKey && googleUser ? html`
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
             class="primary" style="display:block;text-align:center;padding:8px;margin-bottom:8px;text-decoration:none">
            🔑 Créer ma clé gratuite (compte Google déjà connecté)
          </a>` : ''}
        <input type="password" id="setting-gemini-key" .value=${apiKey}
               placeholder="AIza…" style="width:100%" />
        <small style="color:var(--text-muted)">
          ${apiKey
            ? '✓ Clé configurée'
            : googleUser
              ? 'Cliquez ci-dessus → copiez votre clé → collez-la ici'
              : html`Gratuit sur <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">aistudio.google.com</a>`}
        </small>
      </div>

      <div class="field">
        <label>Modèle Gemini</label>
        <select id="setting-gemini-model" style="width:100%" .value=${model}>
          <option value="gemini-flash">Gemini 2.5 Flash — Nano Banana (gratuit, recommandé)</option>
          <option value="imagen-4">Imagen 4 (haute qualité, nécessite un compte payant)</option>
        </select>
      </div>

      <button id="settings-save" class="primary"
              style="width:100%;margin-top:10px" @click=${handleSave}>
        Enregistrer
      </button>
    </div>`
}

// ── Google Identity Services ──────────────────────────────────────────────────

type GisCallback = (response: { credential: string }) => void

declare const google: {
  accounts: { id: { initialize: (opts: object) => void; renderButton: (el: Element, opts: object) => void } }
} | undefined

function initGoogleSignIn(rerender: () => void): void {
  if (!GOOGLE_CLIENT_ID) return
  if (typeof google === 'undefined' || !google?.accounts?.id) return
  if (googleUser) return  // already signed in

  const btnEl = document.getElementById('google-signin-btn')
  if (!btnEl) return

  const callback: GisCallback = ({ credential }) => {
    googleUser = parseJwt(credential)
    rerender()
  }

  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback })
  google.accounts.id.renderButton(btnEl, { type: 'standard', text: 'signin_with', locale: 'fr' })
}

function parseJwt(token: string): GoogleUser {
  try {
    const raw = token.split('.')[1]!
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    // JWT strips trailing '=' padding — add it back for atob compatibility
    const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=')
    const json = atob(padded)
    const payload = JSON.parse(json) as { name: string; email: string; picture?: string }
    return { name: payload.name, email: payload.email, picture: payload.picture }
  } catch {
    // Malformed token — fail gracefully rather than crashing the GIS callback
    return { name: 'Utilisateur Google', email: '' }
  }
}
