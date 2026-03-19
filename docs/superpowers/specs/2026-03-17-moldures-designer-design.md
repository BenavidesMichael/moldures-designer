# Moldures Designer — Design Spec
**Date:** 2026-03-17
**Version:** 2 (post spec-review)
**Statut:** Approuvé par l'utilisateur

---

## 1. Vue d'ensemble

Application web de planification et budgétisation de moulures décoratives murales style classique. L'objectif est de permettre à un utilisateur de visualiser ses cadres de moulures sur un mur à l'échelle réelle, de tester différentes configurations, et de calculer exactement le matériel à acheter avant de se rendre en magasin.

**Ce que l'app fait :**
- Visualise en 2D (vue de face) les cadres et moulures sur un mur à l'échelle
- Calcule le budget matériaux (barres, rosettes) en temps réel
- Exporte une fiche technique PDF à emporter en magasin
- Génère un rendu photoréaliste via l'API Google Gemini
- Sauvegarde le projet dans le navigateur + export/import JSON
- Gère plusieurs murs par projet

**Ce que l'app ne fait pas :**
- Pas de rendu 3D maison (délégué à Gemini)
- Pas de gestion d'angles complexes (saisie de mesures uniquement)
- Pas de backend / comptes utilisateurs
- Pas de support mobile pour la v1

---

## 2. Hébergement & Stack technique

| Élément | Choix | Raison |
|---|---|---|
| Hébergement | GitHub Pages | Gratuit, simple, statique |
| Build tool | Vite | Rapide, zero-config, TypeScript natif |
| Langage | TypeScript vanilla | Familier à l'utilisateur, type-safe |
| Rendu | Canvas 2D natif | Contrôle total, zéro dépendance |
| PDF | jsPDF + jspdf-autotable | Standard TypeScript |
| Canvas→PDF | `canvas.toDataURL()` natif | Le canvas est déjà un canvas — pas besoin de html2canvas |
| IA | `@google/genai` (SDK officiel) | SDK actuel — l'ancien SDK et fetch brut sont dépréciés |
| Stockage | localStorage + JSON | Zéro serveur |

Pas de framework UI. Tout le DOM est géré manuellement en TypeScript.

**Configuration Vite pour GitHub Pages :**
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
export default defineConfig({
  base: '/moldures-designer/',  // doit correspondre au nom exact du repo GitHub
})
```

**GitHub Actions (`.github/workflows/deploy.yml`) :**
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: ['main']
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: 'pages'
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - id: deployment
        uses: actions/deploy-pages@v4
```

---

## 3. Structure du projet

```
moldures-designer/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
│
└── src/
    ├── index.ts                 ← Point d'entrée, init app
    │
    ├── types/
    │   └── index.ts             ← Tous les types TypeScript
    │
    ├── state/
    │   ├── AppState.ts          ← État global de l'app
    │   ├── defaults.ts          ← Valeurs par défaut + premier démarrage
    │   └── storage.ts           ← LocalStorage + Export/Import JSON
    │
    ├── renderer/
    │   ├── Renderer.ts          ← Orchestrateur du canvas
    │   ├── drawWall.ts          ← Fond du mur, plinthe
    │   ├── drawFrames.ts        ← Cadres + imbrication
    │   ├── drawObstacles.ts     ← Radiateur, porte, fenêtre…
    │   ├── drawAnnotations.ts   ← Cotes, mesures en cm
    │   └── scale.ts             ← Calcul échelle px/cm
    │
    ├── ui/
    │   ├── Panel.ts             ← Panneau latéral principal
    │   ├── WallPanel.ts         ← Onglet dimensions mur
    │   ├── FramesPanel.ts       ← Contrôles cadres par zone
    │   ├── MoldingsPanel.ts     ← Catalogue moulures
    │   ├── ObstaclesPanel.ts    ← Gestion obstacles
    │   ├── ProjectPanel.ts      ← Gestion murs du projet
    │   └── BudgetPanel.ts       ← Récapitulatif budget
    │
    └── services/
        ├── pdf.ts               ← Export PDF
        ├── gemini.ts            ← Appel API Gemini
        ├── layout.ts            ← Calcul dimensions cadres (partagé)
        └── project.ts           ← Save/Load multi-murs
```

---

## 4. Modèle de données

### 4.1 Projet

```typescript
interface Project {
  id: string
  version: number               // Pour migration JSON. Actuel = 1
  name: string
  createdAt: string
  walls: Wall[]
  activeWallId: string          // Toujours un id présent dans walls[]
  moldings: Molding[]           // Catalogue partagé entre tous les murs
  rosettes: Rosette[]           // Catalogue rosettes partagé
}
```

**Invariant activeWallId :** quand un mur est supprimé, `activeWallId` est mis à jour vers le premier mur restant. Si `walls` devient vide, un mur par défaut est créé automatiquement.

### 4.2 Mur

```typescript
interface Wall {
  id: string
  name: string
  dimensions: {
    width: number               // cm
    height: number              // cm
    plinthHeight: number        // cm
  }
  zoneMode: '1zone' | '2zones'
  zones: Zone[]
  // Invariant 1-zone : zones.length === 1, zones[0].type === 'full', separator === undefined
  // Invariant 2-zones : zones.length === 2, zones[0].type === 'top', zones[1].type === 'bottom'
  separator?: Separator         // undefined en mode 1-zone
  // Préservation des données : quand on passe de 2-zones à 1-zone,
  // zones[1] est sauvegardé dans archivedBottomZone.
  archivedBottomZone?: Zone
  obstacles: Obstacle[]
  colors: WallColors
  showAnnotations: boolean
}

interface WallColors {
  wall: string                  // ex: '#f5f0e8'
  moldings: string              // '' = chaque moulure utilise sa propre couleur
  plinth: string                // ex: '#ffffff'
  // Règle : si moldings !== '' → override toutes les Molding.color pour ce mur
}
```

### 4.3 Zones

```typescript
interface Zone {
  id: string
  type: 'top' | 'bottom' | 'full'
  layout: ZoneLayout
  frames: Frame[]
  // Chaque Frame est un cadre individuel dans la zone.
  // La zone est un conteneur de mise en page ; elle n'a pas de molure propre.
  // L'utilisateur positionne les cadres dans la zone via layout.
}

interface ZoneLayout {
  frameCount: number            // Nombre de cadres dans la zone
  marginTop: number             // cm, depuis bord haut de la zone
  marginBottom: number          // cm, depuis bord bas de la zone
  marginLeft: number            // cm, depuis bord gauche du mur
  marginRight: number           // cm, depuis bord droit du mur
  gapBetweenFrames: number      // cm, espace entre cadres adjacents
  customWidths: number[]        // Toujours frameCount entrées. 0 = auto
  customHeights: number[]       // Toujours frameCount entrées. 0 = auto
  // Quand frameCount augmente : nouvelles entrées ajoutées en fin avec valeur 0
  // Quand frameCount diminue : entrées excédentaires supprimées en fin
  // Index hors-bornes traité comme 0
}
```

**Calcul de la hauteur de zone (mode 2-zones) :**
- Hauteur utile = `wall.dimensions.height - wall.dimensions.plinthHeight`
- Position séparateur en px = `hauteurUtile × (separator.positionPercent / 100)`
- Zone top occupe `[0, separatorY]` depuis le haut de la zone utile
- Zone bottom occupe `[separatorY, hauteurUtile]`

### 4.4 Cadres

```typescript
interface Frame {
  id: string
  moldingId: string             // Référence dans Project.moldings
  cornerStyle: 'miter' | 'rosette'
  rosetteId?: string            // Référence dans Project.rosettes (si cornerStyle='rosette')
  nestedLevels: NestedLevel[]   // [] = cadre simple, pas de niveaux imbriqués
  // Niveaux imbriqués progressifs : chaque niveau est à l'intérieur du précédent.
}

interface NestedLevel {
  offset: number                // cm depuis le bord intérieur du cadre parent
  moldingId: string
  cornerStyle: 'miter' | 'rosette'
  rosetteId?: string
}

// Les dimensions d'un cadre ne sont PAS stockées sur Frame.
// Elles sont calculées par computeFrameLayout() dans services/layout.ts.
// Le budget et le renderer appellent tous deux computeFrameLayout() pour obtenir
// les dimensions réelles (voir Section 8).
```

### 4.5 Moulures et Rosettes

```typescript
interface Molding {
  id: string
  name: string                  // ex: "Pin PEFC 16×29mm"
  reference: string             // ex: "GAM-16-29-270"
  width: number                 // mm — largeur visible de la barre
  thickness: number             // mm — épaisseur visible (saillie du mur)
  barLength: number             // cm — longueur d'une barre vendue
  pricePerBar: number           // €
  color: string                 // Couleur d'affichage par défaut
}

interface Rosette {
  id: string
  name: string                  // ex: "Moulure D'angle HL344-1"
  reference: string
  size: number                  // cm — dimension du carré (ex: 20.5)
  pricePerPiece: number         // €
}
```

### 4.6 Séparateur

```typescript
interface Separator {
  positionPercent: number       // % de la hauteur utile, depuis le haut
  visible: boolean              // Afficher/cacher le rail
  moldingId: string             // Référence dans Project.moldings
  // Pas de cornerStyle : le rail est toujours pleine largeur du mur,
  // il passe par-dessus les obstacles visuellement.
}
```

### 4.7 Obstacles

```typescript
interface Obstacle {
  id: string
  name: string                  // ex: "Fenêtre salon"
  type: 'window' | 'door' | 'radiator' | 'outlet' | 'switch' | 'fireplace' | 'custom'
  width: number                 // cm
  height: number                // cm
  positionX: number             // cm depuis le bord gauche du mur
  positionY: number             // cm depuis le SOL (pas depuis le haut)
  // Conversion canvas : canvasY = (wallHeight - positionY - height) * scale
  display: {
    transparent: boolean        // true = voir le mur derrière
    fillColor?: string          // Couleur si !transparent
    texture?: 'wood' | 'glass' | 'brick' | 'metal'
  }
}
// Règles de validation :
// - positionX + width <= wall.dimensions.width (erreur inline sinon)
// - positionY + height <= wall.dimensions.height (erreur inline sinon)
// - Les obstacles peuvent empiéter sur la zone plinthe (ex: porte jusqu'au sol)
// - Les obstacles peuvent se chevaucher (pas d'erreur, juste rendu par-dessus)
```

### 4.8 Budget (calculé, jamais stocké)

```typescript
interface BudgetResult {
  lines: BudgetLine[]
  rosetteLines: RosetteBudgetLine[]
  totalCost: number
}

interface BudgetLine {
  moldingId: string
  moldingName: string
  linearMeters: number          // ml totaux avant chute
  wasteFactor: number           // 1.15 pour cadres, 1.0 pour rail — affichage seul, non éditable
  barsNeeded: number            // ceil(linearMeters * wasteFactor / barLength)
  costPerBar: number
  totalCost: number
}

interface RosetteBudgetLine {
  rosetteId: string
  rosetteName: string
  count: number                 // 4 × nb cadres utilisant cette rosette (tous niveaux)
  pricePerPiece: number
  totalCost: number
}
```

---

## 5. Rendu Canvas

### 5.1 Principe général
Rendu impératif complet à chaque changement d'état :
```
Changement d'état → render() → clearRect → redessine tout
```
Debounce 16ms sur les modifications d'état. Redessinage synchrone complet (pas de rendu partiel).

### 5.2 HiDPI / Retina
```typescript
function setupCanvas(canvas: HTMLCanvasElement, container: HTMLElement): void {
  const dpr = window.devicePixelRatio || 1
  canvas.width  = container.clientWidth  * dpr
  canvas.height = container.clientHeight * dpr
  canvas.style.width  = container.clientWidth  + 'px'
  canvas.style.height = container.clientHeight + 'px'
  ctx.scale(dpr, dpr)
}
```

### 5.3 Redimensionnement
Un `ResizeObserver` sur le conteneur du canvas déclenche `setupCanvas()` + `render()` après un debounce de 50ms.

### 5.4 Calcul d'échelle
```typescript
// scale.ts
function computeScale(wallCm: Size, containerPx: Size): number {
  const scaleX = containerPx.width  / wallCm.width
  const scaleY = containerPx.height / wallCm.height
  return Math.min(scaleX, scaleY) * 0.9  // 10% de marge interne
}
```

### 5.5 Ordre de dessin
1. Fond du mur (couleur `WallColors.wall`)
2. Plinthe (rectangle bas, couleur `WallColors.plinth`)
3. Obstacles opaques (`display.transparent = false`)
4. Cadres de tous les niveaux (zone top, puis zone bottom) avec effet biseauté
5. Séparateur/Rail si `separator.visible`
6. Obstacles transparents (`display.transparent = true`)
7. Annotations si `wall.showAnnotations`
8. Alertes collision (bordure rouge clignotante)

### 5.6 Effet 3D biseauté
Chaque barre de moulure = 4 trapèzes autour du rectangle :
- Haut et gauche : `lighten(molding.color, 40%)`
- Bas et droite : `darken(molding.color, 40%)`
- Épaisseur visuelle en px = `molding.thickness / 10 * scale` (mm → cm → px)

Si `WallColors.moldings !== ''`, utiliser cette couleur à la place de `molding.color`.

### 5.7 Algorithme de placement des cadres (dans `services/layout.ts`)

```typescript
// Fonction unique, partagée par renderer et budget
function computeFrameLayout(zone: Zone, zoneRect: Rect, moldings: Molding[]): FrameRect[] {
  const { layout } = zone
  const availableWidth  = zoneRect.width  - layout.marginLeft - layout.marginRight
  const availableHeight = zoneRect.height - layout.marginTop  - layout.marginBottom
  const totalGapWidth   = (layout.frameCount - 1) * layout.gapBetweenFrames
  const fixedWidths     = layout.customWidths.reduce((s, w) => s + w, 0) // somme des largeurs custom != 0
  const autoCount       = layout.customWidths.filter(w => w === 0).length
  const autoWidth       = autoCount > 0
    ? (availableWidth - totalGapWidth - fixedWidths) / autoCount
    : 0

  return Array.from({ length: layout.frameCount }, (_, i) => {
    const w = layout.customWidths[i]  ?? 0
    const h = layout.customHeights[i] ?? 0
    const frameWidth  = w > 0 ? w : autoWidth
    const frameHeight = h > 0 ? h : availableHeight
    const prevFrames  = /* somme des largeurs des cadres 0..i-1 + gaps */
    const x = zoneRect.x + layout.marginLeft + prevFrames
    const y = zoneRect.y + layout.marginTop + (availableHeight - frameHeight) / 2
    return { frameIndex: i, x, y, width: frameWidth, height: frameHeight }
  })
}

// Dimensions d'un niveau imbriqué (offset cumulé depuis le cadre parent)
function computeNestedRect(parentRect: Rect, cumulativeOffset: number): Rect {
  return {
    x: parentRect.x + cumulativeOffset,
    y: parentRect.y + cumulativeOffset,
    width:  parentRect.width  - 2 * cumulativeOffset,
    height: parentRect.height - 2 * cumulativeOffset,
  }
  // Si width ou height <= 0 : niveau ignoré (rendu et budget)
}
```

### 5.8 Détection collision
```typescript
function hasCollision(frame: Rect, obstacle: Rect): boolean {
  return !(frame.right < obstacle.left  || frame.left > obstacle.right ||
           frame.bottom < obstacle.top  || frame.top  > obstacle.bottom)
}
// En cas de collision : bordure rouge + badge "⚠ Collision" dans le panneau Obstacles
```

---

## 6. Interface utilisateur

### 6.1 Layout général
```
┌─────────────────────────────────────────────────────────┐
│  🏠 Moldures Designer    [Projet: Salon] [+ Mur] [⚙️]  │
├──────────────────────────────┬──────────────────────────┤
│                              │  PANNEAU LATÉRAL         │
│      CANVAS                  │  Onglets :               │
│    (vue du mur)              │  📁 Projet               │
│                              │  🧱 Mur                  │
│                              │  🔲 Cadres               │
│                              │  🚧 Obstacles            │
│                              │  🪵 Moulures             │
│                              │  💰 Budget               │
├──────────────────────────────┴──────────────────────────┤
│  [📄 PDF]  [🤖 Gemini]  [💾 Sauvegarder]  [📂 Charger] │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Onglet Projet
- Liste des murs du projet avec onglets ou liste cliquable
- Boutons : ajouter / renommer / dupliquer / supprimer un mur
- Import JSON : `<input type="file" accept=".json">`
- Export JSON : télécharge `projet-nom-YYYY-MM-DD.json`
- Badge "↩ Projet restauré" si données présentes au démarrage

### 6.3 Onglet Mur
- Nom du mur (input text)
- Dimensions : largeur / hauteur / hauteur plinthe (inputs number, cm)
- Toggle : 1 zone / 2 zones
- Couleurs : mur, moulures (override global), plinthe (color pickers)
- Toggle : afficher/cacher les annotations

### 6.4 Onglet Cadres
```
▼ ZONE HAUTE (bleue)
  Nombre de cadres : [1][2][3][4][5][6+]
  Marges : G[  ] D[  ] H[  ] B[  ] cm
  Gap entre cadres : [  ] cm
  Tableau tailles custom :
  ┌──────┬──────────┬──────────┐
  │Cadre │ Largeur  │ Hauteur  │
  │  1   │  [   0 ] │  [   0 ] │  ← 0 = auto
  │  2   │  [  80 ] │  [   0 ] │
  └──────┴──────────┴──────────┘

▼ SÉPARATEUR (si 2 zones)
  Position : [────●──────] 64%
  [ ] Afficher le rail
  Moulure rail : [select]

▼ ZONE BASSE (rose)
  (identique zone haute)

▼ IMBRICATION (par cadre ou globale)
  Niveaux intérieurs : [+ Ajouter niveau]
  Niveau 1 : Décalage [  ] cm  Moulure [select]  Coins [onglet▼]
  Niveau 2 : Décalage [  ] cm  Moulure [select]  Coins [onglet▼]
  Alerte si largeur/hauteur nette ≤ 0 : "⚠ Niveau trop petit"
```

### 6.5 Onglet Obstacles
- Liste des obstacles avec type + dimensions + boutons éditer/supprimer
- Badge "⚠ Collision" si un obstacle chevauche un cadre
- Formulaire ajout/édition :
  - Type (select), Nom, Largeur, Hauteur (cm)
  - Position X (depuis gauche), Y (depuis sol) en cm
  - Validation inline : hors-limites mur → message d'erreur rouge
  - Affichage : transparent ou couleur/texture

### 6.6 Onglet Moulures
- Catalogue des moulures (`Project.moldings`)
- Catalogue des rosettes (`Project.rosettes`)
- Formulaire ajout/édition pour chaque type
- Couleur d'affichage par moulure (color picker)

### 6.7 Onglet Budget
```
┌──────────────────┬──────┬────────┬───────┬─────────┐
│ Moulure          │  ml  │ Chute  │Barres │  Coût   │
├──────────────────┼──────┼────────┼───────┼─────────┤
│ Pin PEFC 16×29   │ 18.4 │ +15%   │   8   │  36.00€ │
│ Rail doré 20×40  │  4.6 │  —     │   2   │  17.80€ │
├──────────────────┼──────┼────────┼───────┼─────────┤
│ Rosettes HL344   │  —   │  —     │  12 × │  21.60€ │
├──────────────────┼──────┼────────┼───────┼─────────┤
│ TOTAL            │      │        │       │  75.40€ │
└──────────────────┴──────┴────────┴───────┴─────────┘
Mis à jour en temps réel à chaque changement.
```

---

## 7. Services

### 7.1 Layout (`services/layout.ts`)
Fonction `computeFrameLayout()` partagée entre renderer et budget (voir §5.7). C'est la **source unique de vérité** pour les dimensions des cadres. Aucun autre module ne recalcule ces dimensions indépendamment.

### 7.2 PDF (`services/pdf.ts`)
- Capture du canvas via `canvas.toDataURL('image/png')` — direct, sans dépendance externe
- **Export mur unique** : bouton "PDF" dans la toolbar → PDF du mur actif
- **Export tous les murs** : bouton "PDF complet" dans l'onglet Projet → un PDF multi-pages

Structure d'un PDF par mur :
```
Page 1 :
  - En-tête : nom projet, nom mur, date
  - Image du canvas (vue de face à l'échelle)
  - Encadré dimensions : largeur, hauteur, plinthe, utile

Page 2 :
  - Tableau mesures par cadre (zone haute + zone basse)
  - Tableau liste matériaux avec colonnes : moulure, ml, barres, coût
  - Total budget
```

Pour le PDF multi-murs : chaque mur génère ses 2 pages, concaténées dans un seul document.

### 7.3 Gemini (`services/gemini.ts`)
**SDK utilisé :** `@google/genai` — SDK officiel actuel (l'ancien `@google/generative-ai` et le fetch brut sont dépréciés)

**Deux options selon le modèle choisi :**

**Option A — Gemini Flash (gratuit, quota standard) :**
```typescript
import { GoogleGenAI } from '@google/genai'

async function generateWallRender(wall: Wall, project: Project, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-preview-image-generation',
    contents: [{ parts: [{ text: buildPrompt(wall, project) }] }],
    config: { responseModalities: ['IMAGE', 'TEXT'] }
  })
  // Image base64 dans response.candidates[0].content.parts
  const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)
  if (!imagePart?.inlineData?.data) throw new Error('No image in response')
  return imagePart.inlineData.data  // base64 PNG
}
```

**Option B — Imagen 4 (meilleure qualité photoréaliste) :**
```typescript
const response = await ai.models.generateImages({
  model: 'imagen-4.0-generate-001',
  prompt: buildPrompt(wall, project),
  config: { numberOfImages: 1, aspectRatio: '16:9', includeRaiReason: true }
})
const imageBytes = response.generatedImages?.[0]?.image?.imageBytes
if (!imageBytes) throw new Error('No image in response')
return imageBytes  // base64
```

**Modèle par défaut recommandé : Gemini Flash** (Option A) — gratuit sans quota spécial.
Imagen 4 nécessite un accès API payant. L'interface permettra de choisir.

**Prompt généré :**
```typescript
function buildPrompt(wall: Wall, project: Project): string {
  const obstacles = wall.obstacles.map(o => `${o.name} (${o.width}×${o.height}cm)`).join(', ')
  const zoneTop   = wall.zones.find(z => z.type === 'top'  || z.type === 'full')
  const zoneBot   = wall.zones.find(z => z.type === 'bottom')
  return `
    Photorealistic interior wall, classical French Haussmann style.
    Wall: ${wall.dimensions.width}cm wide × ${wall.dimensions.height}cm tall.
    Wall color: ${wall.colors.wall}. Molding color: ${wall.colors.moldings || 'white'}.
    Decorative molding frames: upper zone with ${zoneTop?.layout.frameCount ?? 0} rectangular frames,
    ${zoneBot ? `lower zone with ${zoneBot.layout.frameCount} rectangular frames,` : ''}
    separated by a horizontal rail at ${wall.separator?.positionPercent ?? 0}% height.
    ${obstacles ? `Wall elements: ${obstacles}.` : ''}
    Style: elegant classical interior, soft natural light, high quality render, 4K.
  `.trim()
}
```

**Réponse :** image base64 PNG, affichée dans une modale, téléchargeable.

**Gestion des erreurs :**
- Clé invalide (401) → message "Clé API invalide. Vérifiez vos paramètres."
- Quota dépassé (429) → message "Quota Gemini atteint. Réessayez plus tard."
- Réseau (NetworkError) → message "Connexion impossible. Vérifiez votre réseau."
- Timeout > 30s → message "Délai dépassé. Réessayez."

**UI :**
- Spinner overlay sur le canvas pendant la génération
- Image affichée dans une modale plein écran
- Boutons : "Télécharger l'image" + "Inclure dans le prochain PDF"

### 7.4 Save/Load (`services/project.ts` + `state/storage.ts`)
```typescript
// Auto-sauvegarde debounce 500ms
function autoSave(project: Project): void {
  localStorage.setItem('moldures_project', JSON.stringify(project))
  showToast('✓ Sauvegardé')
}

// Export JSON
function exportProject(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  downloadFile(blob, `${project.name}-${toDateString(new Date())}.json`)
}

// Import JSON avec migration
function importProject(raw: unknown): Project {
  const validated = validateAndMigrate(raw)  // throws si invalide
  return validated
}

function validateAndMigrate(raw: unknown): Project {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid project file')
  const data = raw as Record<string, unknown>
  const version = (data.version as number) ?? 1
  // v1 → v2 : ajouter Project.moldings si absent
  if (version < 2) { /* migrations futures */ }
  // Remplir les champs manquants avec les valeurs par défaut
  return mergeWithDefaults(data)
}
```

---

## 8. Calculs budget

Le budget est calculé par `computeBudget(project, wall)` qui appelle `computeFrameLayout()` pour obtenir les dimensions réelles des cadres.

### 8.1 Cadres (avec chute 15%)
```
Pour chaque zone du mur :
  frameRects = computeFrameLayout(zone, zoneRect, project.moldings)

  Pour chaque cadre i :
    frame = zone.frames[i]
    rect  = frameRects[i]

    // Cadre extérieur
    ajouterPérimètre(frame.moldingId, rect, frame.cornerStyle, frame.rosetteId)

    // Niveaux imbriqués
    cumulOffset = 0
    Pour chaque nestedLevel j :
      cumulOffset += nestedLevel.offset + molding.width/10  // offset + épaisseur moulure parent (cm)
      nestedRect = computeNestedRect(rect, cumulOffset)
      Si nestedRect.width <= 0 OU nestedRect.height <= 0 : ignorer ce niveau et les suivants
      ajouterPérimètre(nestedLevel.moldingId, nestedRect, nestedLevel.cornerStyle, nestedLevel.rosetteId)

function ajouterPérimètre(moldingId, rect, cornerStyle, rosetteId):
  Si cornerStyle === 'rosette' ET rosetteId est défini :
    rosette = project.rosettes.find(r => r.id === rosetteId)
    linearM = 2 × ((rect.width - 2 × rosette.size) + (rect.height - 2 × rosette.size)) / 100
    rosetteCount[rosetteId] += 4
  Sinon :
    linearM = 2 × (rect.width + rect.height) / 100  // cm → m
  linearMeters[moldingId] += linearM

Pour chaque moldingId :
  barsNeeded = ceil(linearMeters[moldingId] * 1.15 / molding.barLength * 100)
  cost = barsNeeded × molding.pricePerBar
```

### 8.2 Rail/Séparateur (sans chute)
```
Si separator est défini ET separator.visible :
  linearMeters[separator.moldingId] += wall.dimensions.width / 100
  barsNeeded = ceil(wall.dimensions.width / molding.barLength)
  cost = barsNeeded × molding.pricePerBar
```

### 8.3 Rosettes
```
Pour chaque rosetteId :
  cost = rosetteCount[rosetteId] × rosette.pricePerPiece
```

---

## 9. Persistance

| Donnée | Clé localStorage |
|---|---|
| Projet actif | `moldures_project` |
| Clé API Gemini | `moldures_gemini_key` |

Auto-sauvegarde à chaque modification (debounce 500ms).

| Action | Comportement |
|---|---|
| Démarrage sans données | Charger `defaults.ts` (mur démo 400×250cm) |
| Démarrage avec données | Restaurer + badge "↩ Projet restauré" |
| Bouton Réinitialiser | Vider localStorage + recharger les defaults |
| Import JSON invalide | Toast d'erreur rouge, projet inchangé |
| Export JSON | Téléchargement immédiat, pas de confirmation |

### 9.1 Premier démarrage (`state/defaults.ts`)
```typescript
export const DEFAULT_PROJECT: Project = {
  id: uuid(),
  version: 1,
  name: 'Mon projet',
  createdAt: new Date().toISOString(),
  activeWallId: 'wall-1',
  moldings: [
    { id: 'm1', name: 'Pin PEFC 16×29mm', reference: 'PIN-16-29-270',
      width: 16, thickness: 29, barLength: 270, pricePerBar: 4.50, color: '#e8d5b0' }
  ],
  rosettes: [],
  walls: [{
    id: 'wall-1',
    name: 'Mur principal',
    dimensions: { width: 400, height: 250, plinthHeight: 10 },
    zoneMode: '1zone',
    zones: [{
      id: 'zone-1', type: 'full',
      layout: { frameCount: 2, marginTop: 15, marginBottom: 15,
                marginLeft: 20, marginRight: 20, gapBetweenFrames: 10,
                customWidths: [0, 0], customHeights: [0, 0] },
      frames: [
        { id: 'f1', moldingId: 'm1', cornerStyle: 'miter', nestedLevels: [] },
        { id: 'f2', moldingId: 'm1', cornerStyle: 'miter', nestedLevels: [] },
      ]
    }],
    obstacles: [],
    colors: { wall: '#f5f0e8', moldings: '', plinth: '#ffffff' },
    showAnnotations: true
  }]
}
```

---

## 10. Contraintes & limites

- Application 100% client-side (pas de backend)
- Clé API Gemini requise pour la génération d'images (API gratuite jusqu'au quota)
- Navigateurs supportés : Chrome, Firefox, Safari, Edge (modernes)
- Interface desktop uniquement pour v1 (pas de responsive mobile)
- Pas de collaboration temps réel
- Niveaux imbriqués avec dimensions ≤ 0 sont silencieusement ignorés
- Les obstacles peuvent se chevaucher entre eux (rendu par ordre d'ajout)
- Le rail séparateur est toujours pleine largeur du mur (passe par-dessus les obstacles)
