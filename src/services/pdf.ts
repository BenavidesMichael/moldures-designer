import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Project, Wall } from '../types/index.js'
import { computeBudget } from './budget.js'
import { computeFrameLayout, computeZoneRect } from './layout.js'
// renderToCanvas est la version PURE (sans side-effects) — obligatoire ici pour ne pas
// corrompre _lastCanvas dans Renderer.ts (le zoom wheel pointerait sur le canvas off-screen)
import { renderToCanvas } from '../renderer/Renderer.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Render the wall onto a dedicated off-screen canvas at 2× the display
 * resolution, then return a PNG data URL. Avoids blurry PDFs on Retina screens.
 * Utilise renderToCanvas (pure) pour ne pas écraser _lastCanvas du renderer.
 */
function getHighResDataUrl(canvas: HTMLCanvasElement, wall: Wall, project: Project): string {
  const EXPORT_SCALE = 2
  const off = document.createElement('canvas')
  off.width  = canvas.clientWidth  * EXPORT_SCALE
  off.height = canvas.clientHeight * EXPORT_SCALE
  off.style.width  = canvas.clientWidth  + 'px'
  off.style.height = canvas.clientHeight + 'px'
  const ctx = off.getContext('2d')
  if (!ctx) return ''
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE)
  renderToCanvas(off, wall, project)          // ← pure, pas de side-effects
  return off.toDataURL('image/png')
}

/** didDrawPage callback that adds a centered page number footer. */
function pageNumberFooter(pdf: jsPDF) {
  return {
    didDrawPage: (data: { pageNumber: number }) => {
      pdf.setFontSize(8)
      pdf.setTextColor(150)
      pdf.text(
        `Page ${data.pageNumber}`,
        pdf.internal.pageSize.getWidth() / 2,
        pdf.internal.pageSize.getHeight() - 4,
        { align: 'center' }
      )
      pdf.setTextColor(0)
    },
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function exportWallPdf(canvas: HTMLCanvasElement, project: Project, wall: Wall): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  addWallPage(pdf, canvas, project, wall)
  pdf.save(`${project.name}-${wall.name}.pdf`)
}

export async function exportAllWallsPdf(canvas: HTMLCanvasElement, project: Project): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  for (let i = 0; i < project.walls.length; i++) {
    if (i > 0) pdf.addPage()
    addWallPage(pdf, canvas, project, project.walls[i]!)
  }
  pdf.save(`${project.name}-complet.pdf`)
}

function addWallPage(pdf: jsPDF, canvas: HTMLCanvasElement, project: Project, wall: Wall): void {
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  const date = new Date().toLocaleDateString('fr-FR')

  // ── Page 1: header + canvas image (2× resolution) + dimensions ──
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`${project.name} — ${wall.name}`, 10, 12)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Généré le ${date}`, pw - 10, 12, { align: 'right' })

  // High-res canvas export (avoids blur on Retina/print)
  const imgData = getHighResDataUrl(canvas, wall, project)
  const imgW = pw * 0.55
  const imgH = ph * 0.75
  pdf.addImage(imgData, 'PNG', 10, 18, imgW, imgH)

  // Dimensions box (right side)
  const bx = imgW + 15
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Dimensions du mur', bx, 22)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  const { width, height, plinthHeight } = wall.dimensions
  const dimLines = [
    `Largeur : ${width} cm`,
    `Hauteur : ${height} cm`,
    `Plinthe : ${plinthHeight} cm`,
    `Utile   : ${height - plinthHeight} cm`,
    `Mode    : ${wall.zoneMode}`,
  ]
  dimLines.forEach((line, i) => pdf.text(line, bx, 30 + i * 6))

  // ── Page 2: measurements + budget ──
  pdf.addPage()

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Mesures — ${wall.name}`, 10, 12)

  // Frame measurements table
  const frameRows: (string | number)[][] = []
  for (const zone of wall.zones) {
    const zoneRect = computeZoneRect(wall, zone.type)
    const rects = computeFrameLayout(zone, zoneRect)
    for (const rect of rects) {
      frameRows.push([
        `Zone ${zone.type} — Cadre ${rect.frameIndex + 1}`,
        Math.round(rect.width),
        Math.round(rect.height),
        Math.round(2 * (rect.width + rect.height)),
      ])
    }
  }

  autoTable(pdf, {
    startY: 18,
    head: [['Cadre', 'Largeur (cm)', 'Hauteur (cm)', 'Périmètre (cm)']],
    body: frameRows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [60, 80, 150] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    ...pageNumberFooter(pdf),
  })

  const budget = computeBudget(project, wall)
  const lastTable = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
  const budgetY = (lastTable?.finalY ?? 80) + 10

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Liste de matériaux', 10, budgetY)

  const budgetRows = [
    ...budget.lines.map(l => [l.moldingName, l.linearMeters.toFixed(2) + ' ml', l.wasteFactor === 1.15 ? '+15%' : '—', String(l.barsNeeded), l.totalCost.toFixed(2) + ' €']),
    ...budget.rosetteLines.map(r => [r.rosetteName, '—', '—', `${r.count} pcs`, r.totalCost.toFixed(2) + ' €']),
  ]

  autoTable(pdf, {
    startY: budgetY + 4,
    head: [['Moulure / Rosette', 'Linéaire', 'Chute', 'Qté', 'Coût']],
    body: budgetRows,
    foot: [['TOTAL', '', '', '', budget.totalCost.toFixed(2) + ' €']],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [60, 80, 150] },
    footStyles: { fontStyle: 'bold', fillColor: [220, 220, 240] },
    columnStyles: { 4: { halign: 'right' } },
    ...pageNumberFooter(pdf),
  })
}
