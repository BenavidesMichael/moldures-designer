import { produce } from 'immer'
import { html, render } from 'lit-html'
import type { TemplateResult } from 'lit-html'
import { nanoid } from 'nanoid'
import { getProject, setState, undo } from '../state/AppState.js'
import { showToast } from './toast.js'
import { showImportModal } from './ImportModal.js'
import { MaterialAdvisor } from './MaterialAdvisor.js'
import { PURCHASE_URL_RE } from '../types/schemas.js'
import type { Molding, Rosette, MoldingMaterial } from '../types/index.js'

const MATERIAL_OPTIONS: { value: MoldingMaterial | ''; label: string }[] = [
  { value: '', label: '— Choisir —' },
  { value: 'wood', label: '🪵 Bois massif' },
  { value: 'mdf', label: '📋 MDF' },
  { value: 'pvc', label: '💧 PVC' },
  { value: 'polystyrene', label: '🫧 Polystyrène' },
  { value: 'polyurethane', label: '✨ Polyuréthane' },
  { value: 'other', label: '📦 Autre' },
]

export function MoldingsPanel(): TemplateResult {
  const project = getProject()
  return html`
    <div class="section-title">Moulures</div>
    <ul class="panel-list">
      ${project.moldings.length === 0
        ? html`<li class="empty-hint"><strong>Aucune moulure</strong>Ajoutez les profils de moulures<br>disponibles dans votre stock.</li>`
        : project.moldings.map(m => html`
          <li>
            <span style="display:inline-block;width:12px;height:12px;background:${m.color};border-radius:2px;margin-right:6px"></span>
            <span>${m.name}</span>
            <small style="color:var(--text-muted)">${m.width}×${m.thickness}mm · ${m.barLength}cm · ${m.pricePerBar}€</small>
            <div class="actions">
              ${m.purchaseUrl
                ? html`<a href=${m.purchaseUrl} target="_blank" rel="noopener noreferrer"
                           class="btn-sm" title="Acheter">🛒</a>`
                : html`<a href=${generateAmazonUrl(m)} target="_blank" rel="noopener noreferrer"
                           class="btn-sm" title="Trouver sur Amazon">🔍</a>`}
              <button @click=${() => showMoldingModal(m)}>✏️</button>
              <button class="danger" @click=${() => {
                const moldingName = m.name
                setState(s => produce(s, draft => {
                  draft.project.moldings = draft.project.moldings.filter(x => x.id !== m.id)
                }))
                showToast(`Moulure "${moldingName}" supprimée`, 'success', { label: 'Annuler', onClick: undo })
              }}>🗑️</button>
            </div>
          </li>`)}
    </ul>
    <div style="display:flex;gap:6px;margin-top:6px">
      <button class="primary" style="flex:1" @click=${() => showMoldingModal()}>+ Ajouter moulure</button>
      <button style="flex:1" @click=${openImportModal}>⬇ Importer</button>
    </div>

    <div class="section-title" style="margin-top:16px">Rosettes d'angle</div>
    <ul class="panel-list">
      ${project.rosettes.length === 0
        ? html`<li class="empty-hint"><strong>Aucune rosette</strong>Les rosettes habillent les angles<br>de rencontre des cadres.</li>`
        : project.rosettes.map(r => html`
          <li>
            <span>${r.name}</span>
            <small style="color:var(--text-muted)">${r.size}cm · ${r.pricePerPiece}€/pce</small>
            <div class="actions">
              <button class="danger" @click=${() => {
                const rosetteName = r.name
                setState(s => produce(s, draft => {
                  draft.project.rosettes = draft.project.rosettes.filter(x => x.id !== r.id)
                }))
                showToast(`Rosette "${rosetteName}" supprimée`, 'success', { label: 'Annuler', onClick: undo })
              }}>🗑️</button>
            </div>
          </li>`)}
    </ul>
    <button style="width:100%;margin-top:6px" @click=${showRosetteModal}>+ Ajouter rosette</button>
  `
}

function generateAmazonUrl(m: Molding): string {
  const terms = [m.name, m.reference].filter(Boolean).join(' ')
  return `https://www.amazon.fr/s?k=${encodeURIComponent(terms + ' moulure')}`
}

function moldingFormTpl(
  m: Molding | undefined,
  prefill: Partial<Molding> | undefined,
  currentMaterial: MoldingMaterial | '',
  onMaterialChange: (mat: MoldingMaterial | '') => void,
): TemplateResult {
  // m takes priority (edit mode); prefill provides defaults (import mode)
  const v = (key: keyof Molding, fallback: string) =>
    String(m?.[key] ?? prefill?.[key] ?? fallback)

  const existingId = m?.id

  return html`
    <div style="min-width:260px">
      <h3 style="margin-bottom:12px">${m ? 'Modifier' : 'Nouvelle'} moulure</h3>
      <div class="field"><label>Nom</label>
        <input type="text" id="mf-name" .value=${v('name', '')} /></div>
      <div class="field"><label>Référence</label>
        <input type="text" id="mf-ref" .value=${v('reference', '')} /></div>
      <div class="field-row">
        <div class="field"><label>Largeur (mm)</label>
          <input type="number" id="mf-width" .value=${v('width', '16')} min="1" /></div>
        <div class="field"><label>Épaisseur (mm)</label>
          <input type="number" id="mf-thick" .value=${v('thickness', '29')} min="1" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Longueur barre (cm)</label>
          <input type="number" id="mf-bar" .value=${v('barLength', '270')} min="10" /></div>
        <div class="field"><label>Prix/barre (€)</label>
          <input type="number" id="mf-price" .value=${v('pricePerBar', '0')} min="0" step="0.01" /></div>
      </div>
      <div class="field"><label>Couleur</label>
        <input type="color" id="mf-color" .value=${v('color', '#e8d5b0')} /></div>
      <div class="field"><label>Matériau</label>
        <select id="mf-material"
                @change=${(e: Event) => onMaterialChange((e.target as HTMLSelectElement).value as MoldingMaterial | '')}>
          ${MATERIAL_OPTIONS.map(opt => html`
            <option value=${opt.value} ?selected=${currentMaterial === opt.value}>${opt.label}</option>`)}
        </select></div>
      ${currentMaterial ? MaterialAdvisor(currentMaterial as MoldingMaterial) : ''}
      <div class="field"><label>Lien d'achat (optionnel)</label>
        <input type="text" id="mf-purchase-url"
               .value=${v('purchaseUrl', '')}
               placeholder="https://amazon.fr/dp/…" /></div>
      <button class="primary" style="margin-top:10px;width:100%"
              @click=${() => saveMolding(existingId)}>Enregistrer</button>
    </div>`
}

function showMoldingModal(m?: Molding, prefill?: Partial<Molding>): void {
  const content = document.getElementById('modal-content')
  const modal = document.getElementById('app-modal')
  if (!content || !modal) return

  // Stateful closure — re-renders when user changes the material dropdown
  let selectedMaterial: MoldingMaterial | '' = (m?.material ?? prefill?.material ?? '') as MoldingMaterial | ''
  const renderTpl = () =>
    render(moldingFormTpl(m, prefill, selectedMaterial, (mat) => {
      selectedMaterial = mat
      renderTpl()
    }), content)
  renderTpl()
  modal.classList.remove('hidden')
}

function saveMolding(existingId?: string): void {
  const nameEl  = document.getElementById('mf-name')  as HTMLInputElement | null
  const refEl   = document.getElementById('mf-ref')   as HTMLInputElement | null
  const widthEl = document.getElementById('mf-width') as HTMLInputElement | null
  const thickEl = document.getElementById('mf-thick') as HTMLInputElement | null
  const barEl   = document.getElementById('mf-bar')   as HTMLInputElement | null
  const priceEl = document.getElementById('mf-price') as HTMLInputElement | null
  const colorEl = document.getElementById('mf-color') as HTMLInputElement | null
  if (!nameEl || !refEl || !widthEl || !thickEl || !barEl || !priceEl || !colorEl) return

  const purchaseUrlRaw = (document.getElementById('mf-purchase-url') as HTMLInputElement | null)?.value?.trim() ?? ''
  if (purchaseUrlRaw && !PURCHASE_URL_RE.test(purchaseUrlRaw)) {
    showToast('URL invalide — doit commencer par https:// ou http://', 'error')
    return
  }
  const purchaseUrl = purchaseUrlRaw || undefined
  const materialRaw = (document.getElementById('mf-material') as HTMLSelectElement | null)?.value ?? ''
  const material = materialRaw ? materialRaw as MoldingMaterial : undefined

  const molding: Molding = {
    id:          existingId ?? nanoid(),
    name:        nameEl.value,
    reference:   refEl.value,
    width:       Number(widthEl.value),
    thickness:   Number(thickEl.value),
    barLength:   Number(barEl.value),
    pricePerBar: Number(priceEl.value),
    color:       colorEl.value,
    ...(material    ? { material }    : {}),
    ...(purchaseUrl ? { purchaseUrl } : {}),
  }
  setState(s => produce(s, draft => {
    const idx = draft.project.moldings.findIndex(x => x.id === molding.id)
    if (idx >= 0) draft.project.moldings[idx] = molding
    else          draft.project.moldings.push(molding)
  }))
  const modal = document.getElementById('app-modal')
  modal?.classList.add('hidden')
}

function openImportModal(): void {
  showImportModal((prefill) => {
    // Replace ImportModal content with the molding form (modal stays open)
    showMoldingModal(undefined, prefill)
  })
}

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
    document.getElementById('app-modal')?.classList.add('hidden')
  }

  const content = document.getElementById('modal-content')
  const modal = document.getElementById('app-modal')
  if (!content || !modal) return

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
  `, content)

  renderTpl()
  modal.classList.remove('hidden')
}
