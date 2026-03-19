import { html } from 'lit-html'
import { nanoid } from 'nanoid'
import { produce } from 'immer'
import { getActiveWall, getProject, setState } from '../state/AppState.js'

type Zone = NonNullable<ReturnType<typeof getActiveWall>>['zones'][number]

function updateZone(zoneId: string, recipe: (z: Zone) => void): void {
  setState(s => produce(s, draft => {
    const wall = draft.project.walls.find(w => w.id === draft.project.activeWallId)
    const zone = wall?.zones.find(z => z.id === zoneId)
    if (zone) recipe(zone)
  }))
}

function setFrameCount(zoneId: string, count: number): void {
  updateZone(zoneId, z => {
    z.layout.frameCount = count
    while (z.layout.customWidths.length  < count) z.layout.customWidths.push(0)
    while (z.layout.customHeights.length < count) z.layout.customHeights.push(0)
    z.layout.customWidths  = z.layout.customWidths.slice(0, count)
    z.layout.customHeights = z.layout.customHeights.slice(0, count)
    while (z.frames.length < count) z.frames.push({ id: nanoid(), moldingId: z.frames[0]?.moldingId ?? 'm1', cornerStyle: 'miter', nestedLevels: [] })
    z.frames = z.frames.slice(0, count)
  })
}

function zoneSection(zone: Zone, moldingOptions: ReturnType<typeof html>[]) {
  const cls  = zone.type === 'top' ? 'zone-top' : zone.type === 'bottom' ? 'zone-bottom' : ''
  const title = zone.type === 'top' ? 'Zone haute' : zone.type === 'bottom' ? 'Zone basse' : 'Zone'
  const l = zone.layout
  return html`
    <div class=${cls} style="padding-left:8px;margin-bottom:16px">
      <div class="zone-title">${title}</div>
      <div class="field-row">
        ${[1,2,3,4,5,6].map(n => html`
          <button class=${l.frameCount === n ? 'primary' : ''}
                  @click=${() => setFrameCount(zone.id, n)}>${n}</button>`)}
      </div>
      <div class="section-title">Marges (cm)</div>
      <div class="field-row">
        ${(['left','right','top','bottom'] as const).map(side => html`
          <div class="field">
            <label>${side.charAt(0).toUpperCase() + side.slice(1)}</label>
            <input type="number" .value=${l[`margin${side.charAt(0).toUpperCase()+side.slice(1)}` as 'marginLeft']} min="0"
                   @input=${(e: Event) => updateZone(zone.id, z => {
                     z.layout[`margin${side.charAt(0).toUpperCase()+side.slice(1)}` as 'marginLeft'] = Number((e.target as HTMLInputElement).value)
                   })} />
          </div>`)}
      </div>
      <div class="field">
        <label>Gap entre cadres (cm)</label>
        <input type="number" .value=${l.gapBetweenFrames} min="0"
               @input=${(e: Event) => updateZone(zone.id, z => { z.layout.gapBetweenFrames = Number((e.target as HTMLInputElement).value) })} />
      </div>
      <div class="section-title">Tailles custom (0 = auto)</div>
      <table><thead><tr><th>#</th><th>Largeur</th><th>Hauteur</th></tr></thead>
        <tbody>
          ${Array.from({ length: l.frameCount }, (_, i) => html`
            <tr>
              <td>${i + 1}</td>
              <td><input type="number" .value=${l.customWidths[i] ?? 0} min="0"
                         @input=${(e: Event) => updateZone(zone.id, z => { z.layout.customWidths[i] = Number((e.target as HTMLInputElement).value) })} /></td>
              <td><input type="number" .value=${l.customHeights[i] ?? 0} min="0"
                         @input=${(e: Event) => updateZone(zone.id, z => { z.layout.customHeights[i] = Number((e.target as HTMLInputElement).value) })} /></td>
            </tr>`)}
        </tbody>
      </table>
      ${zone.frames[0] ? html`
        <div class="section-title">Imbrication (cadre 1)</div>
        ${zone.frames[0].nestedLevels.map((lvl, j) => html`
          <div class="field-row">
            <div class="field"><label>Décalage (cm)</label>
              <input type="number" .value=${lvl.offset} min="0" step="0.5"
                     @input=${(e: Event) => updateZone(zone.id, z => { const lvl = z.frames[0]?.nestedLevels[j]; if (lvl) lvl.offset = Number((e.target as HTMLInputElement).value) })} />
            </div>
            <div class="field"><label>Moulure</label>
              <select @change=${(e: Event) => updateZone(zone.id, z => { const lvl = z.frames[0]?.nestedLevels[j]; if (lvl) lvl.moldingId = (e.target as HTMLSelectElement).value })}>
                ${moldingOptions}
              </select>
            </div>
            <button class="danger" @click=${() => updateZone(zone.id, z => { z.frames[0]?.nestedLevels.splice(j, 1) })}>✕</button>
          </div>`)}
        <button @click=${() => updateZone(zone.id, z => { z.frames[0]?.nestedLevels.push({ offset: 2, moldingId: z.frames[0].moldingId, cornerStyle: 'miter' }) })}>+ Ajouter niveau</button>
      ` : ''}
    </div>`
}

export function FramesPanel() {
  const wall = getActiveWall()
  const project = getProject()
  if (!wall) return html`<p>Aucun mur.</p>`

  const moldingOptions = project.moldings.map(m => html`<option value=${m.id}>${m.name}</option>`)

  const sep = wall.separator
  return html`
    ${wall.zones.map(zone => zoneSection(zone, moldingOptions))}
    ${wall.zoneMode === '2zones' && sep ? html`
      <div class="section-title">Séparateur / Rail</div>
      <div class="field-row">
        <div class="field">
          <label>Position (${sep.positionPercent}%)</label>
          <input type="range" min="20" max="80" .value=${sep.positionPercent}
                 @input=${(e: Event) => setState(s => produce(s, draft => {
                   const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
                   if (w?.separator) w.separator.positionPercent = Number((e.target as HTMLInputElement).value)
                 }))} />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>
            <input type="checkbox" ?checked=${sep.visible}
                   @change=${(e: Event) => setState(s => produce(s, draft => {
                     const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
                     if (w?.separator) w.separator.visible = (e.target as HTMLInputElement).checked
                   }))} />
            Afficher le rail
          </label>
        </div>
        <div class="field">
          <label>Moulure rail</label>
          <select @change=${(e: Event) => setState(s => produce(s, draft => {
            const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
            if (w?.separator) w.separator.moldingId = (e.target as HTMLSelectElement).value
          }))}>
            ${project.moldings.map(m => html`<option value=${m.id} ?selected=${m.id === sep.moldingId}>${m.name}</option>`)}
          </select>
        </div>
      </div>
    ` : ''}
  `
}
