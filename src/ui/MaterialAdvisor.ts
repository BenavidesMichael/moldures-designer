import { html } from 'lit-html'
import type { TemplateResult } from 'lit-html'
import type { MoldingMaterial, MaterialInfo } from '../types/index.js'

const MATERIAL_INFO: Record<MoldingMaterial, MaterialInfo> = {
  wood: {
    label: 'Bois massif',
    icon: '🪵',
    pros: [
      'Aspect authentique et haut de gamme',
      'Se peint et se teinte facilement',
      'Durable dans le temps',
    ],
    notes: [
      "Sensible à l'humidité — prévoir une primaire d'étanchéité en zone humide",
    ],
    priceRange: '€€€',
    idealFor: 'Salon, chambre, couloir, pièce de prestige',
  },
  mdf: {
    label: 'MDF',
    icon: '📋',
    pros: [
      'Surface parfaitement lisse',
      'Facile à peindre',
      'Économique',
    ],
    notes: [
      "Absorbe l'humidité — une couche d'apprêt ou de peinture adaptée suffit généralement",
    ],
    priceRange: '€€',
    idealFor: 'Salon, chambre, bureau',
  },
  pvc: {
    label: 'PVC',
    icon: '💧',
    pros: [
      'Étanche et imputrescible',
      'Léger et facile à poser',
      'Entretien facile',
    ],
    notes: [
      'Difficile à peindre sans primaire spécifique PVC',
    ],
    priceRange: '€',
    idealFor: 'Salle de bain, cuisine, pièces humides',
  },
  polystyrene: {
    label: 'Polystyrène',
    icon: '🫧',
    pros: [
      'Très léger',
      'Économique',
      'Pose simple (colle ou adhésif)',
    ],
    notes: [
      'Plus fragile que les autres matériaux',
    ],
    priceRange: '€',
    idealFor: 'Décoration intérieure, budget serré',
  },
  polyurethane: {
    label: 'Polyuréthane',
    icon: '✨',
    pros: [
      'Imitation bois très convaincante',
      'Léger et résistant aux chocs',
      "Bonne résistance à l'humidité",
    ],
    notes: [],
    priceRange: '€€',
    idealFor: 'Salon, couloir, escalier',
  },
  other: {
    label: 'Autre matériau',
    icon: '📦',
    pros: [],
    notes: ['Renseignez-vous auprès du fabricant pour les spécificités de pose'],
    priceRange: '—',
    idealFor: '—',
  },
}

export function MaterialAdvisor(material: MoldingMaterial): TemplateResult {
  const info = MATERIAL_INFO[material]
  return html`
    <details class="material-advisor" open>
      <summary class="material-advisor__summary">
        ${info.icon} ${info.label} — Conseils expert
      </summary>
      <div class="material-advisor__body">
        ${info.pros.length > 0 ? html`
          <ul class="material-advisor__list material-advisor__list--pros">
            ${info.pros.map(p => html`<li>✅ ${p}</li>`)}
          </ul>` : ''}
        ${info.notes.length > 0 ? html`
          <ul class="material-advisor__list material-advisor__list--notes">
            ${info.notes.map(n => html`<li>ℹ️ ${n}</li>`)}
          </ul>` : ''}
        <div class="material-advisor__meta">
          <span>💰 ${info.priceRange}</span>
          ${info.idealFor !== '—' ? html`<span>🎯 ${info.idealFor}</span>` : ''}
        </div>
      </div>
    </details>`
}
