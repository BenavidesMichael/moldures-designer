import { html } from 'lit-html'
import { nanoid } from 'nanoid'
import { produce } from 'immer'
import { getActiveWall, getProject, setState } from '../state/AppState.js'

type Zone  = NonNullable<ReturnType<typeof getActiveWall>>['zones'][number]
type Frame = Zone['frames'][number]

// ── State helpers ─────────────────────────────────────────────────────────────

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
    while (z.frames.length < count)
      z.frames.push({ id: nanoid(), moldingId: z.frames[0]?.moldingId ?? 'm1', cornerStyle: 'miter', nestedLevels: [] })
    z.frames = z.frames.slice(0, count)
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function nestedLevelRow(
  zoneId: string,
  fi: number,
  frame: Frame,
  j: number,
  moldingOptions: ReturnType<typeof html>[],
  hasRosettes: boolean,
) {
  const lvl = frame.nestedLevels[j]!
  return html`
    <div class="nested-level-row">
      <div class="field">
        <label>Moulure</label>
        <select .value=${lvl.moldingId} @change=${(e: Event) => updateZone(zoneId, z => {
          const l = z.frames[fi]?.nestedLevels[j]
          if (l) l.moldingId = (e.target as HTMLSelectElement).value
        })}>
          ${moldingOptions}
        </select>
      </div>
      <div class="field-row" style="align-items:flex-end">
        <div class="field">
          <label>Décalage (cm)</label>
          <input type="number" .value=${lvl.offset} min="0" step="0.5"
                 @input=${(e: Event) => updateZone(zoneId, z => {
                   const l = z.frames[fi]?.nestedLevels[j]
                   if (l) l.offset = Number((e.target as HTMLInputElement).value)
                 })} />
        </div>
        <div class="field">
          <label>Angle</label>
          <select @change=${(e: Event) => updateZone(zoneId, z => {
            const l = z.frames[fi]?.nestedLevels[j]
            if (!l) return
            const val = (e.target as HTMLSelectElement).value as 'miter' | 'rosette'
            l.cornerStyle = val
            if (val === 'rosette' && !l.rosetteId) l.rosetteId = getProject().rosettes[0]?.id
          })}>
            <option value="miter"   ?selected=${lvl.cornerStyle !== 'rosette'}>Onglet</option>
            <option value="rosette" ?selected=${lvl.cornerStyle === 'rosette'}
                    ?disabled=${!hasRosettes}>✦ Rosette</option>
          </select>
        </div>
        <button class="danger" style="flex-shrink:0;padding:4px 7px;align-self:flex-end"
                @click=${() => updateZone(zoneId, z => { z.frames[fi]?.nestedLevels.splice(j, 1) })}>✕</button>
      </div>
      ${lvl.cornerStyle === 'rosette' ? html`
        <div class="field" style="margin-top:4px">
          <label>Rosette</label>
          <select .value=${lvl.rosetteId ?? ''} @change=${(e: Event) => updateZone(zoneId, z => {
            const l = z.frames[fi]?.nestedLevels[j]
            if (l) l.rosetteId = (e.target as HTMLSelectElement).value
          })}>
            ${getProject().rosettes.map(r => html`<option value=${r.id}>${r.name} (${r.size}cm)</option>`)}
          </select>
        </div>` : ''}
    </div>`
}

function frameCard(
  zoneId: string,
  frame: Frame,
  fi: number,
  moldingOptions: ReturnType<typeof html>[],
  hasRosettes: boolean,
) {
  const project    = getProject()
  const moldingName = project.moldings.find(m => m.id === frame.moldingId)?.name ?? '—'
  const nestedCount = frame.nestedLevels.length
  const isRosette   = frame.cornerStyle === 'rosette'

  return html`
    <details class="frame-card">
      <summary>
        <span class="frame-card-chevron">▶</span>
        <strong style="min-width:52px">Cadre ${fi + 1}</strong>
        <span style="color:var(--text-muted);font-size:0.72rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${moldingName}${isRosette ? ' · ✦' : ''}${nestedCount > 0 ? ` · ${nestedCount} niv.` : ''}
        </span>
      </summary>

      <div class="frame-card__body">

        <!-- Moulure -->
        <div class="field">
          <label>Moulure</label>
          <select .value=${frame.moldingId} @change=${(e: Event) => updateZone(zoneId, z => {
            const f = z.frames[fi]; if (f) f.moldingId = (e.target as HTMLSelectElement).value
          })}>
            ${moldingOptions}
          </select>
        </div>

        <!-- Angle -->
        <div class="field">
          <label>Style d'angle</label>
          <div class="field-row">
            <button class=${frame.cornerStyle !== 'rosette' ? 'primary' : ''}
                    style="flex:1"
                    @click=${() => updateZone(zoneId, z => {
                      const f = z.frames[fi]; if (f) { f.cornerStyle = 'miter'; f.rosetteId = undefined }
                    })}>Onglet</button>
            <button class=${isRosette ? 'primary' : ''}
                    style="flex:1"
                    ?disabled=${!hasRosettes}
                    title=${!hasRosettes ? 'Créez d\'abord une rosette dans Moulures' : ''}
                    @click=${() => updateZone(zoneId, z => {
                      const f = z.frames[fi]; if (!f) return
                      f.cornerStyle = 'rosette'
                      if (!f.rosetteId) f.rosetteId = getProject().rosettes[0]?.id
                    })}>✦ Rosette</button>
          </div>
        </div>
        ${isRosette ? html`
          <div class="field">
            <label>Rosette</label>
            <select .value=${frame.rosetteId ?? ''} @change=${(e: Event) => updateZone(zoneId, z => {
              const f = z.frames[fi]; if (f) f.rosetteId = (e.target as HTMLSelectElement).value
            })}>
              ${project.rosettes.map(r => html`<option value=${r.id}>${r.name} (${r.size}cm)</option>`)}
            </select>
          </div>` : ''}

        <!-- Niveaux imbriqués -->
        <div class="nested-section">
          <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:2px">
            Sous-cadres (${nestedCount})
          </div>
          ${frame.nestedLevels.map((_, j) =>
            nestedLevelRow(zoneId, fi, frame, j, moldingOptions, hasRosettes)
          )}
          <button style="margin-top:6px;font-size:0.72rem;width:100%"
                  @click=${() => updateZone(zoneId, z => {
                    const f = z.frames[fi]
                    if (f) f.nestedLevels.push({ offset: 2, moldingId: f.moldingId, cornerStyle: 'miter' })
                  })}>+ Ajouter sous-cadre</button>
        </div>

      </div>
    </details>`
}

function zoneSection(
  zone: Zone,
  moldingOptions: ReturnType<typeof html>[],
  hasRosettes: boolean,
) {
  const l      = zone.layout
  const isTop  = zone.type === 'top'
  const isBot  = zone.type === 'bottom'
  const cls    = isTop ? 'zone-top' : isBot ? 'zone-bottom' : ''
  const accent = isBot ? 'var(--color-zone-bottom)' : 'var(--color-accent)'
  const title  = isTop ? '▲ Zone haute' : isBot ? '▼ Zone basse' : '◼ Zone'

  return html`
    <div class=${cls} style="margin-bottom:18px">

      <!-- Zone header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${accent}">${title}</span>
        <!-- Frame count pills -->
        <div style="display:flex;gap:3px">
          ${[1,2,3,4,5,6].map(n => html`
            <button style="min-width:24px;padding:1px 5px;font-size:0.7rem"
                    class=${l.frameCount === n ? 'primary' : ''}
                    @click=${() => setFrameCount(zone.id, n)}>${n}</button>`)}
        </div>
      </div>

      <!-- Marges compactes -->
      <details>
        <summary style="cursor:pointer;font-size:0.72rem;color:var(--text-muted);list-style:none;padding:2px 0;margin-bottom:4px">
          ▶ Marges &amp; gaps
        </summary>
        <div style="padding:6px 0 4px">
          <div class="field-row">
            ${(['marginLeft','marginRight','marginTop','marginBottom'] as const).map(key => {
              const labels: Record<string, string> = { marginLeft:'Gauche', marginRight:'Droite', marginTop:'Haut', marginBottom:'Bas' }
              return html`
                <div class="field">
                  <label>${labels[key]}</label>
                  <input type="number" .value=${l[key]} min="0"
                         @input=${(e: Event) => updateZone(zone.id, z => {
                           z.layout[key] = Number((e.target as HTMLInputElement).value)
                         })} />
                </div>`
            })}
          </div>
          <div class="field">
            <label>Gap entre cadres (cm)</label>
            <input type="number" .value=${l.gapBetweenFrames} min="0"
                   @input=${(e: Event) => updateZone(zone.id, z => {
                     z.layout.gapBetweenFrames = Number((e.target as HTMLInputElement).value)
                   })} />
          </div>
        </div>
      </details>

      <!-- Tailles custom compactes -->
      ${l.frameCount > 0 ? html`
        <details>
          <summary style="cursor:pointer;font-size:0.72rem;color:var(--text-muted);list-style:none;padding:2px 0;margin-bottom:4px">
            ▶ Tailles personnalisées (0 = auto)
          </summary>
          <div style="padding:4px 0">
            <table style="font-size:0.72rem">
              <thead><tr><th>#</th><th>Largeur</th><th>Hauteur</th></tr></thead>
              <tbody>
                ${Array.from({ length: l.frameCount }, (_, i) => html`
                  <tr>
                    <td style="color:var(--text-muted)">${i + 1}</td>
                    <td><input type="number" .value=${l.customWidths[i] ?? 0} min="0"
                               @input=${(e: Event) => updateZone(zone.id, z => {
                                 z.layout.customWidths[i] = Number((e.target as HTMLInputElement).value)
                               })} /></td>
                    <td><input type="number" .value=${l.customHeights[i] ?? 0} min="0"
                               @input=${(e: Event) => updateZone(zone.id, z => {
                                 z.layout.customHeights[i] = Number((e.target as HTMLInputElement).value)
                               })} /></td>
                  </tr>`)}
              </tbody>
            </table>
          </div>
        </details>` : ''}

      <!-- Cartes par cadre -->
      ${zone.frames.map((frame, fi) => frameCard(zone.id, frame, fi, moldingOptions, hasRosettes))}

    </div>`
}

// ── Panel principal ───────────────────────────────────────────────────────────

export function FramesPanel() {
  const wall    = getActiveWall()
  const project = getProject()
  if (!wall) return html`<p>Aucun mur.</p>`

  const moldingOptions = project.moldings.map(m => html`<option value=${m.id}>${m.name}</option>`)
  const hasRosettes    = project.rosettes.length > 0

  const sep = wall.separator
  return html`
    ${wall.zones.map(zone => zoneSection(zone, moldingOptions, hasRosettes))}

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
