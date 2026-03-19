import { produce } from 'immer'
import { html, render } from 'lit-html'
import type { TemplateResult } from 'lit-html'
import { nanoid } from 'nanoid'
import { getActiveWall, setState } from '../state/AppState.js'
import type { Obstacle, ObstacleType, Wall } from '../types/index.js'

const OBSTACLE_ICONS: Record<ObstacleType, string> = {
  window: '🪟', door: '🚪', radiator: '🔥',
  outlet: '🔌', switch: '💡', fireplace: '🔥', custom: '📦',
}

export function ObstaclesPanel(): TemplateResult {
  const wall = getActiveWall()
  if (!wall) return html`<p>Aucun mur.</p>`

  return html`
    <div class="section-title">Obstacles</div>
    <ul class="panel-list">
      ${wall.obstacles.length === 0
        ? html`<li style="color:var(--text-muted)">Aucun obstacle</li>`
        : wall.obstacles.map(o => html`
          <li>
            <span>${OBSTACLE_ICONS[o.type]} ${o.name}</span>
            <small style="color:var(--text-muted)">${o.width}×${o.height}cm @ (${o.positionX}, ${o.positionY})</small>
            <div class="actions">
              <button @click=${() => showObstacleModal(o)}>✏️</button>
              <button class="danger" @click=${() => setState(s => produce(s, draft => {
                const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
                if (w) w.obstacles = w.obstacles.filter(x => x.id !== o.id)
              }))}>🗑️</button>
            </div>
          </li>`)}
    </ul>
    <button class="primary" style="width:100%;margin-top:6px" @click=${() => showObstacleModal()}>+ Ajouter obstacle</button>
  `
}

const OBS_TYPES: ObstacleType[] = ['window','door','radiator','outlet','switch','fireplace','custom']

function obstacleFormTpl(wall: Wall, o?: Obstacle): TemplateResult {
  return html`
    <div style="min-width:260px">
      <h3 style="margin-bottom:12px">${o ? 'Modifier' : 'Nouvel'} obstacle</h3>
      <div class="field">
        <label>Type</label>
        <select id="obs-type">
          ${OBS_TYPES.map(t => html`<option value=${t} ?selected=${o?.type === t}>${OBSTACLE_ICONS[t]} ${t}</option>`)}
        </select>
      </div>
      <div class="field"><label>Nom</label><input type="text" id="obs-name" .value=${o?.name ?? ''} /></div>
      <div class="field-row">
        <div class="field"><label>Largeur (cm)</label><input type="number" id="obs-w" .value=${String(o?.width ?? 90)} min="1" /></div>
        <div class="field"><label>Hauteur (cm)</label><input type="number" id="obs-h" .value=${String(o?.height ?? 90)} min="1" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>X depuis gauche (cm)</label><input type="number" id="obs-x" .value=${String(o?.positionX ?? 15)} min="0" /></div>
        <div class="field"><label>Y depuis sol (cm)</label><input type="number" id="obs-y" .value=${String(o?.positionY ?? 5)} min="0" /></div>
      </div>
      <div id="obs-bounds-error" style="color:#e05555;font-size:0.8rem;display:none">⚠ Hors limites du mur</div>
      <div class="field">
        <label>
          <input type="checkbox" id="obs-transparent" ?checked=${o?.display.transparent ?? false}
                 @change=${(e: Event) => {
                   const checked = (e.target as HTMLInputElement).checked
                   const cf = document.getElementById('obs-color-field')
                   if (cf) cf.style.display = checked ? 'none' : ''
                 }} />
          Transparent
        </label>
      </div>
      <div class="field" id="obs-color-field" style=${o?.display.transparent ? 'display:none' : ''}>
        <label>Couleur</label>
        <input type="color" id="obs-color" .value=${o?.display.fillColor ?? '#aaaaaa'} />
      </div>
      <button class="primary" style="margin-top:10px;width:100%" @click=${() => saveObstacle(wall, o?.id)}>Enregistrer</button>
    </div>`
}

function showObstacleModal(o?: Obstacle): void {
  const wall = getActiveWall()
  if (!wall) return
  render(obstacleFormTpl(wall, o), document.getElementById('modal-content')!)
  document.getElementById('app-modal')!.classList.remove('hidden')
}

function saveObstacle(wall: Wall, existingId?: string): void {
  const obsW  = Number((document.getElementById('obs-w') as HTMLInputElement).value)
  const obsH  = Number((document.getElementById('obs-h') as HTMLInputElement).value)
  const obsX  = Number((document.getElementById('obs-x') as HTMLInputElement).value)
  const obsY  = Number((document.getElementById('obs-y') as HTMLInputElement).value)
  const errEl = document.getElementById('obs-bounds-error')!
  if (obsX + obsW > wall.dimensions.width || obsY + obsH > wall.dimensions.height) {
    errEl.style.display = ''; return
  }
  errEl.style.display = 'none'
  const obs: Obstacle = {
    id:   existingId ?? nanoid(),
    name: (document.getElementById('obs-name')  as HTMLInputElement).value,
    type: (document.getElementById('obs-type')  as HTMLSelectElement).value as ObstacleType,
    width: obsW, height: obsH, positionX: obsX, positionY: obsY,
    display: {
      transparent: (document.getElementById('obs-transparent') as HTMLInputElement).checked,
      fillColor:   (document.getElementById('obs-color')       as HTMLInputElement).value,
    },
  }
  setState(s => produce(s, draft => {
    const w = draft.project.walls.find(w => w.id === draft.project.activeWallId)
    if (!w) return
    const idx = w.obstacles.findIndex(x => x.id === obs.id)
    if (idx >= 0) w.obstacles[idx] = obs
    else          w.obstacles.push(obs)
  }))
  document.getElementById('app-modal')!.classList.add('hidden')
}
