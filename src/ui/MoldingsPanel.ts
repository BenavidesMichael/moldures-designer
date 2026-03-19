import { produce } from 'immer'
import { html, render } from 'lit-html'
import type { TemplateResult } from 'lit-html'
import { nanoid } from 'nanoid'
import { getProject, setState } from '../state/AppState.js'
import type { Molding, Rosette } from '../types/index.js'

export function MoldingsPanel(): TemplateResult {
  const project = getProject()
  return html`
    <div class="section-title">Moulures</div>
    <ul class="panel-list">
      ${project.moldings.length === 0
        ? html`<li style="color:var(--text-muted)">Aucune moulure</li>`
        : project.moldings.map(m => html`
          <li>
            <span style="display:inline-block;width:12px;height:12px;background:${m.color};border-radius:2px;margin-right:6px"></span>
            <span>${m.name}</span>
            <small style="color:var(--text-muted)">${m.width}×${m.thickness}mm · ${m.barLength}cm · ${m.pricePerBar}€</small>
            <div class="actions">
              <button @click=${() => showMoldingModal(m)}>✏️</button>
              <button class="danger" @click=${() => {
                if (!confirm('Supprimer cette moulure ?')) return
                setState(s => produce(s, draft => {
                  draft.project.moldings = draft.project.moldings.filter(x => x.id !== m.id)
                }))
              }}>🗑️</button>
            </div>
          </li>`)}
    </ul>
    <button class="primary" style="width:100%;margin-top:6px" @click=${() => showMoldingModal()}>+ Ajouter moulure</button>

    <div class="section-title" style="margin-top:16px">Rosettes d'angle</div>
    <ul class="panel-list">
      ${project.rosettes.length === 0
        ? html`<li style="color:var(--text-muted)">Aucune rosette</li>`
        : project.rosettes.map(r => html`
          <li>
            <span>${r.name}</span>
            <small style="color:var(--text-muted)">${r.size}cm · ${r.pricePerPiece}€/pce</small>
            <div class="actions">
              <button class="danger" @click=${() => setState(s => produce(s, draft => {
                draft.project.rosettes = draft.project.rosettes.filter(x => x.id !== r.id)
              }))}>🗑️</button>
            </div>
          </li>`)}
    </ul>
    <button style="width:100%;margin-top:6px" @click=${addRosette}>+ Ajouter rosette</button>
  `
}

function moldingFormTpl(m?: Molding): TemplateResult {
  const existingId = m?.id
  return html`
    <div style="min-width:260px">
      <h3 style="margin-bottom:12px">${m ? 'Modifier' : 'Nouvelle'} moulure</h3>
      <div class="field"><label>Nom</label><input type="text" id="mf-name" .value=${m?.name ?? ''} /></div>
      <div class="field"><label>Référence</label><input type="text" id="mf-ref" .value=${m?.reference ?? ''} /></div>
      <div class="field-row">
        <div class="field"><label>Largeur (mm)</label><input type="number" id="mf-width" .value=${String(m?.width ?? 16)} min="1" /></div>
        <div class="field"><label>Épaisseur (mm)</label><input type="number" id="mf-thick" .value=${String(m?.thickness ?? 29)} min="1" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Longueur barre (cm)</label><input type="number" id="mf-bar" .value=${String(m?.barLength ?? 270)} min="10" /></div>
        <div class="field"><label>Prix/barre (€)</label><input type="number" id="mf-price" .value=${String(m?.pricePerBar ?? 0)} min="0" step="0.01" /></div>
      </div>
      <div class="field"><label>Couleur</label><input type="color" id="mf-color" .value=${m?.color ?? '#e8d5b0'} /></div>
      <button class="primary" style="margin-top:10px;width:100%" @click=${() => saveMolding(existingId)}>Enregistrer</button>
    </div>`
}

function showMoldingModal(m?: Molding): void {
  render(moldingFormTpl(m), document.getElementById('modal-content')!)
  document.getElementById('app-modal')!.classList.remove('hidden')
}

function saveMolding(existingId?: string): void {
  const molding: Molding = {
    id:          existingId ?? nanoid(),
    name:        (document.getElementById('mf-name')  as HTMLInputElement).value,
    reference:   (document.getElementById('mf-ref')   as HTMLInputElement).value,
    width:       Number((document.getElementById('mf-width') as HTMLInputElement).value),
    thickness:   Number((document.getElementById('mf-thick') as HTMLInputElement).value),
    barLength:   Number((document.getElementById('mf-bar')   as HTMLInputElement).value),
    pricePerBar: Number((document.getElementById('mf-price') as HTMLInputElement).value),
    color:       (document.getElementById('mf-color') as HTMLInputElement).value,
  }
  setState(s => produce(s, draft => {
    const idx = draft.project.moldings.findIndex(x => x.id === molding.id)
    if (idx >= 0) draft.project.moldings[idx] = molding
    else          draft.project.moldings.push(molding)
  }))
  document.getElementById('app-modal')!.classList.add('hidden')
}

function addRosette(): void {
  const name = prompt('Nom de la rosette :'); if (!name) return
  const size  = Number(prompt('Taille (cm) :', '20.5'))
  const price = Number(prompt('Prix/pièce (€) :', '9.68'))
  const r: Rosette = { id: nanoid(), name, reference: '', size, pricePerPiece: price }
  setState(s => produce(s, draft => { draft.project.rosettes.push(r) }))
}
