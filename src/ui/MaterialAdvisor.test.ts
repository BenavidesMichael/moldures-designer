import { describe, it, expect } from 'vitest'
import { render as litRender } from 'lit-html'
import { MaterialAdvisor } from './MaterialAdvisor.js'

function renderAdvisor(material: Parameters<typeof MaterialAdvisor>[0]): Element {
  const container = document.createElement('div')
  litRender(MaterialAdvisor(material), container)
  return container
}

describe('MaterialAdvisor', () => {
  it('affiche la fiche bois massif', () => {
    const el = renderAdvisor('wood')
    expect(el.textContent).toContain('Bois massif')
    expect(el.textContent).toContain('Aspect authentique')
    expect(el.textContent).toContain('€€€')
  })

  it('affiche la fiche MDF', () => {
    const el = renderAdvisor('mdf')
    expect(el.textContent).toContain('MDF')
    expect(el.textContent).toContain('Surface parfaitement lisse')
  })

  it('affiche la fiche PVC avec mention étanche', () => {
    const el = renderAdvisor('pvc')
    expect(el.textContent).toContain('PVC')
    expect(el.textContent).toContain('Étanche')
  })

  it('affiche la fiche polystyrène', () => {
    const el = renderAdvisor('polystyrene')
    expect(el.textContent).toContain('Polystyrène')
    expect(el.textContent).toContain('léger')
  })

  it('affiche la fiche polyuréthane', () => {
    const el = renderAdvisor('polyurethane')
    expect(el.textContent).toContain('Polyuréthane')
    expect(el.textContent).toContain('Imitation bois')
  })

  it('affiche la fiche générique pour other', () => {
    const el = renderAdvisor('other')
    expect(el.textContent).toContain('Autre matériau')
    expect(el.textContent).toContain('fabricant')
  })

  it('la fiche est un <details> ouvert par défaut', () => {
    const el = renderAdvisor('wood')
    const details = el.querySelector('details')
    expect(details).not.toBeNull()
    expect(details!.hasAttribute('open')).toBe(true)
  })
})
