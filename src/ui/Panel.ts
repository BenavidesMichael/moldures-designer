import { render } from 'lit-html'
import { subscribe } from '../state/AppState.js'
import { ProjectPanel } from './ProjectPanel.js'
import { WallPanel }    from './WallPanel.js'
import { FramesPanel }  from './FramesPanel.js'
import { ObstaclesPanel } from './ObstaclesPanel.js'
import { MoldingsPanel }  from './MoldingsPanel.js'
import { BudgetPanel }    from './BudgetPanel.js'
import type { TemplateResult } from 'lit-html'

type TabId = 'project' | 'wall' | 'frames' | 'obstacles' | 'moldings' | 'budget'

const panels: Record<TabId, () => TemplateResult> = {
  project:   ProjectPanel,
  wall:      WallPanel,
  frames:    FramesPanel,
  obstacles: ObstaclesPanel,
  moldings:  MoldingsPanel,
  budget:    BudgetPanel,
}

let activeTab: TabId = 'project'

export function initPanel(): void {
  const tabs = document.getElementById('panel-tabs')!

  tabs.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tab-btn') as HTMLElement | null
    if (!btn) return
    const tab = btn.dataset['tab'] as TabId
    if (!tab || tab === activeTab) return
    activeTab = tab
    tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    renderPanel()
  })

  subscribe(() => renderPanel())
  renderPanel()
}

function renderPanel(): void {
  const content = document.getElementById('panel-content')!
  // render() de lit-html : diff DOM — seuls les noeuds changés sont mis à jour
  // Les handlers @click=${fn} sont attachés automatiquement par lit-html
  render(panels[activeTab](), content)
}
