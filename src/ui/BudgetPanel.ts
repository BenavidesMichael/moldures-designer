import { html } from 'lit-html'
import type { TemplateResult } from 'lit-html'
import { getActiveWall, getProject } from '../state/AppState.js'
import { computeBudget } from '../services/budget.js'

export function BudgetPanel(): TemplateResult {
  const wall    = getActiveWall()
  const project = getProject()
  if (!wall) return html`<p>Aucun mur.</p>`

  const budget = computeBudget(project, wall)

  return html`
    <div class="section-title">Récapitulatif budget</div>
    <table>
      <thead><tr><th>Moulure</th><th>ml</th><th>Chute</th><th>Barres</th><th>Coût</th></tr></thead>
      <tbody>
        ${budget.lines.map(l => html`
          <tr>
            <td>${l.moldingName}</td>
            <td>${l.linearMeters.toFixed(2)}</td>
            <td>${l.wasteFactor === 1.15 ? '+15%' : '—'}</td>
            <td>${l.barsNeeded}</td>
            <td>${l.totalCost.toFixed(2)} €</td>
          </tr>`)}
        ${budget.rosetteLines.map(r => html`
          <tr>
            <td>${r.rosetteName}</td>
            <td>—</td><td>—</td>
            <td>${r.count} ×</td>
            <td>${r.totalCost.toFixed(2)} €</td>
          </tr>`)}
        ${budget.lines.length === 0 && budget.rosetteLines.length === 0
          ? html`<tr><td colspan="5" style="color:var(--text-muted);text-align:center">Aucun cadre défini</td></tr>`
          : ''}
      </tbody>
      <tfoot>
        <tr style="font-weight:700">
          <td colspan="4">TOTAL</td>
          <td>${budget.totalCost.toFixed(2)} €</td>
        </tr>
      </tfoot>
    </table>
    <p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
      +15% chute inclus pour les cadres. Mis à jour en temps réel.
    </p>
  `
}
