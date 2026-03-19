import { html } from 'lit-html'
import { nanoid } from 'nanoid'
import { produce } from 'immer'
import { getActiveWall, setState } from '../state/AppState.js'

function updateWall(recipe: (w: NonNullable<ReturnType<typeof getActiveWall>>) => void): void {
  setState(s => produce(s, draft => {
    const wall = draft.project.walls.find(w => w.id === draft.project.activeWallId)
    if (wall) recipe(wall)
  }))
}

export function WallPanel() {
  const wall = getActiveWall()
  if (!wall) return html`<p>Aucun mur sélectionné.</p>`

  return html`
    <div class="field">
      <label>Nom du mur</label>
      <input type="text" .value=${wall.name}
             @input=${(e: Event) => updateWall(w => { w.name = (e.target as HTMLInputElement).value })} />
    </div>
    <div class="section-title">Dimensions</div>
    <div class="field-row">
      <div class="field">
        <label>Largeur (cm)</label>
        <input type="number" .value=${wall.dimensions.width} min="50" max="2000"
               @input=${(e: Event) => updateWall(w => { w.dimensions.width = Number((e.target as HTMLInputElement).value) })} />
      </div>
      <div class="field">
        <label>Hauteur (cm)</label>
        <input type="number" .value=${wall.dimensions.height} min="50" max="500"
               @input=${(e: Event) => updateWall(w => { w.dimensions.height = Number((e.target as HTMLInputElement).value) })} />
      </div>
    </div>
    <div class="field">
      <label>Hauteur plinthe (cm)</label>
      <input type="number" .value=${wall.dimensions.plinthHeight} min="0" max="50"
             @input=${(e: Event) => updateWall(w => { w.dimensions.plinthHeight = Number((e.target as HTMLInputElement).value) })} />
    </div>
    <div class="section-title">Zones</div>
    <div class="field-row">
      <button class=${wall.zoneMode === '1zone' ? 'primary' : ''}
              @click=${() => updateWall(w => {
                if (w.zoneMode === '1zone') return
                w.archivedBottomZone = w.zones.find(z => z.type === 'bottom')
                w.zones = w.zones.filter(z => z.type !== 'bottom').map(z => ({ ...z, type: 'full' as const }))
                w.zoneMode = '1zone'; w.separator = undefined
              })}>1 zone</button>
      <button class=${wall.zoneMode === '2zones' ? 'primary' : ''}
              @click=${() => updateWall(w => {
                if (w.zoneMode === '2zones') return
                const topZone = { ...w.zones[0]!, type: 'top' as const }
                const botZone = w.archivedBottomZone ?? { ...w.zones[0]!, id: nanoid(), type: 'bottom' as const }
                w.zones = [topZone, botZone]
                w.zoneMode = '2zones'
                w.separator = w.separator ?? { positionPercent: 60, visible: true, moldingId: w.zones[0]?.frames[0]?.moldingId ?? 'm1' }
              })}>2 zones</button>
    </div>
    <div class="section-title">Couleurs</div>
    <div class="field-row">
      <div class="field">
        <label>Mur</label>
        <input type="color" .value=${wall.colors.wall}
               @input=${(e: Event) => updateWall(w => { w.colors.wall = (e.target as HTMLInputElement).value })} />
      </div>
      <div class="field">
        <label>Moulures</label>
        <input type="color" .value=${wall.colors.moldings || '#e8d5b0'}
               @input=${(e: Event) => {
                 const override = (document.getElementById('color-moldings-override') as HTMLInputElement | null)?.checked
                 updateWall(w => { w.colors.moldings = override ? (e.target as HTMLInputElement).value : '' })
               }} />
        <label class="mt-1">
          <input type="checkbox" id="color-moldings-override" ?checked=${!!wall.colors.moldings}
                 @change=${(e: Event) => {
                   const checked = (e.target as HTMLInputElement).checked
                   const color = (document.getElementById('color-moldings') as HTMLInputElement | null)?.value ?? '#e8d5b0'
                   updateWall(w => { w.colors.moldings = checked ? color : '' })
                 }} />
          Override global
        </label>
      </div>
      <div class="field">
        <label>Plinthe</label>
        <input type="color" .value=${wall.colors.plinth}
               @input=${(e: Event) => updateWall(w => { w.colors.plinth = (e.target as HTMLInputElement).value })} />
      </div>
    </div>
    <div class="field mt-2">
      <label>
        <input type="checkbox" ?checked=${wall.showAnnotations}
               @change=${(e: Event) => updateWall(w => { w.showAnnotations = (e.target as HTMLInputElement).checked })} />
        Afficher les cotes
      </label>
    </div>
  `
}
