# Purchase Guide & Gemini Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add material-aware molding import via Gemini text extraction, per-molding purchase links, an expert material advisor, and Google Sign-In to the Moldures Designer app.

**Architecture:** Four additive features layered on existing infrastructure — new types extend `Molding` without breaking old data, a new `extractMoldingFromText()` function joins `gemini.ts`, two new UI components (`MaterialAdvisor`, `ImportModal`) follow the existing lit-html pattern, and `SettingsModal.ts` replaces the inline `showSettingsModal()` in `index.ts`.

**Tech Stack:** TypeScript (strict), Vite, lit-html, Zod, Vitest + jsdom, Google Identity Services (GIS)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/index.ts` | Modify | Add `MoldingMaterial`, `MaterialInfo`, `ExtractedMolding` types; extend `Molding` |
| `src/types/schemas.ts` | Modify | Add Zod validation for `material` and `purchaseUrl` in `MoldingSchema` |
| `src/types/schemas.test.ts` | Create | Tests for `PURCHASE_URL_RE` and `MoldingSchema` backward compat |
| `src/services/gemini.ts` | Modify | Add `extractMoldingFromText(text, apiKey, url?)` |
| `src/services/gemini.test.ts` | Create | Tests for `extractMoldingFromText` |
| `src/ui/MaterialAdvisor.ts` | Create | lit-html component rendering material expert card |
| `src/ui/MaterialAdvisor.test.ts` | Create | Tests for `MaterialAdvisor` |
| `src/ui/ImportModal.ts` | Create | Paste + Gemini extraction modal, calls back with `Partial<Molding>` |
| `src/ui/ImportModal.test.ts` | Create | Tests for `ImportModal` |
| `src/ui/SettingsModal.ts` | Create | Replaces inline `showSettingsModal()` in `index.ts`; adds Google Sign-In |
| `src/ui/SettingsModal.test.ts` | Create | Tests for `SettingsModal` |
| `src/ui/MoldingsPanel.ts` | Modify | Material dropdown, `purchaseUrl` field, buy buttons, import button |
| `src/ui/MoldingsPanel.test.ts` | Modify | Extend with buy button and purchaseUrl validation tests |
| `src/index.ts` | Modify | Replace inline `showSettingsModal` with import from `SettingsModal.ts` |
| `index.html` | Modify | Add GIS `<script>` tag |
| `src/style.css` | Modify | Add `.material-advisor`, `.google-profile`, `.buy-btn` styles |

---

## Chunk 1: Types, Schema, Gemini Service

### Task 1: Extend types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add new types to `src/types/index.ts`**

After the `Molding` interface (currently ends at line 97), add:

```typescript
// ─── Molding material ───────────────────────────────────────────────────────
export type MoldingMaterial =
  | 'wood'
  | 'mdf'
  | 'pvc'
  | 'polystyrene'
  | 'polyurethane'
  | 'other'

export interface MaterialInfo {
  label: string
  icon: string
  pros: string[]
  notes: string[]
  priceRange: string
  idealFor: string
}

// Intermediate type returned by Gemini extraction (all fields nullable)
export interface ExtractedMolding {
  name: string | null
  material: MoldingMaterial | null
  width: number | null
  thickness: number | null
  barLength: number | null
  pricePerBar: number | null
  reference: string | null
}
```

Extend the existing `Molding` interface by adding two optional fields at the bottom:

```typescript
export interface Molding {
  id: string
  name: string
  reference: string
  width: number      // mm
  thickness: number  // mm
  barLength: number  // cm
  pricePerBar: number // €
  color: string      // hex
  material?: MoldingMaterial          // NEW
  purchaseUrl?: string                // NEW — https:// or http:// only
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (the new fields are optional, existing code unaffected).

- [ ] **Step 3: Run existing tests to confirm no regression**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add MoldingMaterial, MaterialInfo, ExtractedMolding; extend Molding"
```

---

### Task 2: Extend Zod schema

**Files:**
- Modify: `src/types/schemas.ts`

- [ ] **Step 1: Add `purchaseUrl` regex constant and extend `MoldingSchema`**

Add before `MoldingSchema`:

```typescript
export const PURCHASE_URL_RE = /^https?:\/\//i
```

Replace the non-exported `MoldingSchema` (currently lines 97–106) with the following exported version:

```typescript
export const MoldingSchema = z.object({
  id:            z.string(),
  name:          z.string().max(100),
  reference:     z.string().max(50),
  width:         z.number().min(1).max(500),
  thickness:     z.number().min(1).max(500),
  barLength:     z.number().min(1),
  pricePerBar:   z.number().min(0),
  color:         z.string(),
  material:      z.enum(['wood', 'mdf', 'pvc', 'polystyrene', 'polyurethane', 'other']).optional(),
  purchaseUrl:   z.string().url().refine(u => PURCHASE_URL_RE.test(u), {
    message: 'URL must start with https:// or http://',
  }).optional(),
})
```

- [ ] **Step 2: Write the schema validation tests** — create `src/types/schemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { MoldingSchema, PURCHASE_URL_RE } from './schemas.js'

describe('PURCHASE_URL_RE', () => {
  it('accepte https://', () => expect(PURCHASE_URL_RE.test('https://amazon.fr/dp/B001')).toBe(true))
  it('accepte http://', () => expect(PURCHASE_URL_RE.test('http://amazon.fr/dp/B001')).toBe(true))
  it('rejette javascript:', () => expect(PURCHASE_URL_RE.test('javascript:alert(1)')).toBe(false))
  it('rejette les URLs sans protocole', () => expect(PURCHASE_URL_RE.test('amazon.fr/dp/B001')).toBe(false))
})

describe('MoldingSchema — compatibilité ascendante', () => {
  const base = {
    id: 'abc', name: 'Baroque', reference: 'REF1',
    width: 16, thickness: 29, barLength: 270, pricePerBar: 12, color: '#fff',
  }

  it('parse une moulure sans les nouveaux champs', () => {
    expect(MoldingSchema.safeParse(base).success).toBe(true)
  })

  it('accepte material et purchaseUrl valides', () => {
    expect(MoldingSchema.safeParse({
      ...base, material: 'wood', purchaseUrl: 'https://amazon.fr/dp/B001',
    }).success).toBe(true)
  })

  it('rejette purchaseUrl avec protocole javascript:', () => {
    expect(MoldingSchema.safeParse({
      ...base, purchaseUrl: 'javascript:alert(1)',
    }).success).toBe(false)
  })

  it('rejette purchaseUrl sans protocole http(s)', () => {
    expect(MoldingSchema.safeParse({
      ...base, purchaseUrl: 'amazon.fr/dp/B001',
    }).success).toBe(false)
  })
})
```

- [ ] **Step 3: Run schema tests**

```bash
npm test src/types/schemas.test.ts
```

Expected: all 8 tests PASS (`PURCHASE_URL_RE` is exported, `MoldingSchema` is exported and validates correctly).

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all pass. Old molding data without `material`/`purchaseUrl` parses correctly because both fields are `.optional()`.

- [ ] **Step 5: Commit**

```bash
git add src/types/schemas.ts src/types/schemas.test.ts
git commit -m "feat(schema): add material and purchaseUrl validation to MoldingSchema"
```

---

### Task 3: `extractMoldingFromText` in gemini service

**Files:**
- Modify: `src/services/gemini.ts`
- Create: `src/services/gemini.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/services/gemini.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Simpler mock: capture the generateContent spy before the module is loaded
const mockGenerateContent = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({ models: { generateContent: mockGenerateContent } })),
}))

import { extractMoldingFromText } from './gemini.js'

function makeResponse(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] }
}

describe('extractMoldingFromText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('extrait tous les champs depuis un texte complet', async () => {
    mockGenerateContent.mockResolvedValueOnce(makeResponse(JSON.stringify({
      name: 'Moulure Baroque 16x29',
      material: 'wood',
      width: 16,
      thickness: 29,
      barLength: 270,
      pricePerBar: 12.5,
      reference: 'MBQ-16',
    })))

    const result = await extractMoldingFromText('fiche produit...', 'AIza-test')

    expect(result.name).toBe('Moulure Baroque 16x29')
    expect(result.material).toBe('wood')
    expect(result.width).toBe(16)
    expect(result.thickness).toBe(29)
    expect(result.barLength).toBe(270)
    expect(result.pricePerBar).toBe(12.5)
    expect(result.reference).toBe('MBQ-16')
  })

  it('omet les champs null — Partial<Molding> sans clés nulles', async () => {
    mockGenerateContent.mockResolvedValueOnce(makeResponse(JSON.stringify({
      name: 'Moulure PVC',
      material: 'pvc',
      width: null,
      thickness: null,
      barLength: null,
      pricePerBar: null,
      reference: null,
    })))

    const result = await extractMoldingFromText('texte partiel', 'AIza-test')

    expect(result.name).toBe('Moulure PVC')
    expect(result.material).toBe('pvc')
    expect('width' in result).toBe(false)
    expect('thickness' in result).toBe(false)
    expect('reference' in result).toBe(false)
  })

  it('lève une GeminiError si le JSON est invalide', async () => {
    mockGenerateContent.mockResolvedValueOnce(makeResponse('voici ma réponse: {invalide}'))

    await expect(extractMoldingFromText('texte', 'AIza-test'))
      .rejects.toMatchObject({ message: expect.stringContaining('Extraction échouée') })
  })

  it('lève une GeminiError si la clé API est vide', async () => {
    await expect(extractMoldingFromText('texte', ''))
      .rejects.toMatchObject({ message: expect.stringContaining('Clé API') })
  })

  it('gère les réponses Gemini encadrées en markdown (```json...```)', async () => {
    mockGenerateContent.mockResolvedValueOnce(makeResponse(
      '```json\n{"name":"Test","material":null,"width":20,"thickness":null,"barLength":null,"pricePerBar":null,"reference":null}\n```',
    ))

    const result = await extractMoldingFromText('texte', 'AIza-test')
    expect(result.name).toBe('Test')
    expect(result.width).toBe(20)
    expect('material' in result).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test src/services/gemini.test.ts
```

Expected: FAIL — `extractMoldingFromText is not exported`

- [ ] **Step 3: Implement `extractMoldingFromText` in `src/services/gemini.ts`**

Add the following imports at the top (after existing imports):

```typescript
import type { ExtractedMolding, Molding } from '../types/index.js'
```

Add these two functions **after** the `GeminiError` class (class declarations are not hoisted — defining functions that call `new GeminiError()` before the class declaration would cause a ReferenceError if the module were used before fully loading):

```typescript
export async function extractMoldingFromText(
  text: string,
  apiKey: string,
  url?: string,
): Promise<Partial<Molding>> {
  if (!apiKey) throw new GeminiError('Clé API manquante. Configurez-la dans ⚙️ Paramètres.')

  const ai = new GoogleGenAI({ apiKey })
  const prompt = buildExtractionPrompt(text)

  let raw: string
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_IDS['gemini-flash'], // gemini-2.0-flash — hardcoded for extraction; not user-configurable
        contents: [{ parts: [{ text: prompt }] }],
      }),
      TIMEOUT_MS,
    )
    raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  } catch (err) {
    throw translateError(err)
  }

  // Strip markdown code fences if present (e.g. ```json ... ```)
  const json = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  let extracted: ExtractedMolding
  try {
    extracted = JSON.parse(json) as ExtractedMolding
  } catch {
    throw new GeminiError('Extraction échouée — réponse invalide de Gemini. Remplissez manuellement.')
  }

  // Strip null values — Partial<Molding> must not contain null keys
  const result = Object.fromEntries(
    Object.entries(extracted).filter(([, v]) => v !== null),
  ) as Partial<Molding>

  // Attach purchase URL if valid — immutable spread (never mutate result)
  const HTTPS_RE = /^https?:\/\//i
  return url && HTTPS_RE.test(url) ? { ...result, purchaseUrl: url } : result
}

function buildExtractionPrompt(text: string): string {
  return `Tu es un expert en moulures décoratives. Extrais les informations suivantes depuis ce texte de fiche produit et retourne UNIQUEMENT un JSON valide, sans markdown, sans commentaires.

Texte:"""
${text}
"""

JSON attendu (null si champ non trouvé) :
{"name":null,"material":null,"width":null,"thickness":null,"barLength":null,"pricePerBar":null,"reference":null}

Règles :
- material : exactement l'une de ces valeurs ou null : "wood", "mdf", "pvc", "polystyrene", "polyurethane", "other"
- width, thickness : en mm (nombre)
- barLength : en cm (nombre)
- pricePerBar : en euros (nombre)`
}
```

- [ ] **Step 4: Run tests**

```bash
npm test src/services/gemini.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/gemini.ts src/services/gemini.test.ts
git commit -m "feat(gemini): add extractMoldingFromText with Gemini Flash"
```

---

## Chunk 2: UI Components

### Task 4: `MaterialAdvisor` component

**Files:**
- Create: `src/ui/MaterialAdvisor.ts`
- Create: `src/ui/MaterialAdvisor.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/ui/MaterialAdvisor.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test src/ui/MaterialAdvisor.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/ui/MaterialAdvisor.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests**

```bash
npm test src/ui/MaterialAdvisor.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/MaterialAdvisor.ts src/ui/MaterialAdvisor.test.ts
git commit -m "feat(ui): add MaterialAdvisor component with expert material cards"
```

---

### Task 5: `ImportModal` component

**Files:**
- Create: `src/ui/ImportModal.ts`
- Create: `src/ui/ImportModal.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/ui/ImportModal.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/gemini.js', () => ({
  extractMoldingFromText: vi.fn(),
}))
vi.mock('../state/AppState.js', () => ({
  getState: vi.fn(() => ({ geminiApiKey: 'AIza-test', geminiModel: 'gemini-flash' })),
}))
vi.mock('./toast.js', () => ({ showToast: vi.fn() }))

import { showImportModal } from './ImportModal.js'
import { extractMoldingFromText } from '../services/gemini.js'
import { showToast } from './toast.js'

function setupDOM(): void {
  document.body.innerHTML = `
    <div id="app-modal" class="hidden"></div>
    <div id="modal-content"></div>`
}

describe('showImportModal', () => {
  beforeEach(() => {
    setupDOM()
    vi.clearAllMocks()
  })

  it('ouvre le modal', () => {
    showImportModal(vi.fn())
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(false)
  })

  it('bouton Extraire désactivé quand le texte est vide', () => {
    showImportModal(vi.fn())
    const btn = document.querySelector<HTMLButtonElement>('button[disabled]')
    expect(btn).not.toBeNull()
  })

  it('URL invalide — message d\'erreur affiché, extraction toujours possible si texte présent', async () => {
    const onExtracted = vi.fn()
    vi.mocked(extractMoldingFromText).mockResolvedValue({ name: 'Test' })

    showImportModal(onExtracted)

    // Enter invalid URL
    const urlInput = document.getElementById('import-url') as HTMLInputElement
    urlInput.value = 'javascript:alert(1)'
    urlInput.dispatchEvent(new Event('input'))

    // Error message should be visible
    expect(document.body.textContent).toContain('invalide')

    // Extraction button should be enabled if text is present
    const textArea = document.getElementById('import-text') as HTMLTextAreaElement
    textArea.value = 'Moulure bois 16x29mm'
    textArea.dispatchEvent(new Event('input'))

    const btn = document.getElementById('import-extract-btn') as HTMLButtonElement | null
    expect(btn).not.toBeNull()
    expect(btn!.disabled).toBe(false)  // button enabled despite invalid URL
  })

  it('extraction réussie — onExtracted appelé avec les données + URL valide', async () => {
    const onExtracted = vi.fn()
    // Simulate real behavior: function receives url param and attaches it
    vi.mocked(extractMoldingFromText).mockImplementation(async (_t, _k, url) =>
      ({ name: 'Moulure Test', width: 16, ...(url ? { purchaseUrl: url } : {}) }),
    )

    showImportModal(onExtracted)

    const urlInput = document.getElementById('import-url') as HTMLInputElement
    urlInput.value = 'https://amazon.fr/dp/B123'
    urlInput.dispatchEvent(new Event('input'))

    const textArea = document.getElementById('import-text') as HTMLTextAreaElement
    textArea.value = 'Moulure bois 16x29mm 270cm'
    textArea.dispatchEvent(new Event('input'))

    const btn = document.getElementById('import-extract-btn') as HTMLButtonElement
    btn.click()  // click() returns void — no await

    // Wait for async extraction
    await vi.waitFor(() => expect(onExtracted).toHaveBeenCalledOnce())
    expect(onExtracted).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Moulure Test', purchaseUrl: 'https://amazon.fr/dp/B123' }),
    )
  })

  it('URL invalide — purchaseUrl absent de onExtracted', async () => {
    const onExtracted = vi.fn()
    vi.mocked(extractMoldingFromText).mockResolvedValue({ name: 'Test' })

    showImportModal(onExtracted)

    const urlInput = document.getElementById('import-url') as HTMLInputElement
    urlInput.value = 'javascript:alert(1)'
    urlInput.dispatchEvent(new Event('input'))

    const textArea = document.getElementById('import-text') as HTMLTextAreaElement
    textArea.value = 'fiche produit'
    textArea.dispatchEvent(new Event('input'))

    document.getElementById('import-extract-btn')!.click()

    await vi.waitFor(() => expect(onExtracted).toHaveBeenCalledOnce())
    // Invalid URL must not reach extractMoldingFromText — ImportModal passes undefined
    expect(extractMoldingFromText).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), undefined,
    )
    expect(onExtracted.mock.calls[0][0]).not.toHaveProperty('purchaseUrl')
  })

  it('échec d\'extraction — showToast erreur, modal reste ouvert', async () => {
    vi.mocked(extractMoldingFromText).mockRejectedValue(new Error('Extraction échouée'))

    showImportModal(vi.fn())

    const textArea = document.getElementById('import-text') as HTMLTextAreaElement
    textArea.value = 'texte'
    textArea.dispatchEvent(new Event('input'))

    const btn = document.getElementById('import-extract-btn') as HTMLButtonElement
    btn.click()  // click() returns void — no await

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Extraction échouée'), 'error',
    ))
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test src/ui/ImportModal.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/ui/ImportModal.ts`**

```typescript
import { html, render } from 'lit-html'
import { extractMoldingFromText } from '../services/gemini.js'
import { getState } from '../state/AppState.js'
import { showToast } from './toast.js'
import { PURCHASE_URL_RE } from '../types/schemas.js'
import type { Molding } from '../types/index.js'

export function showImportModal(onExtracted: (data: Partial<Molding>) => void): void {
  let text = ''
  let url = ''
  let urlError = ''
  let loading = false

  const modal = document.getElementById('app-modal')
  const content = document.getElementById('modal-content')
  if (!modal || !content) return

  const renderTpl = (): void => render(html`
    <div style="min-width:300px">
      <h3 style="margin-bottom:12px">⬇ Importer depuis fiche produit</h3>

      <div class="field">
        <label>Lien produit (optionnel)</label>
        <input type="text" id="import-url"
               .value=${url}
               placeholder="https://amazon.fr/dp/…"
               @input=${(e: Event) => {
                 url = (e.target as HTMLInputElement).value.trim()
                 urlError = url && !PURCHASE_URL_RE.test(url)
                   ? 'URL invalide — doit commencer par https:// ou http://'
                   : ''
                 renderTpl()
               }} />
        ${urlError ? html`<small style="color:var(--error,#c0392b)">${urlError}</small>` : ''}
      </div>

      <div class="field">
        <label>Texte de la fiche produit *</label>
        <textarea id="import-text" rows="6"
                  style="width:100%;resize:vertical;box-sizing:border-box"
                  placeholder="Collez ici le titre + la description + les dimensions copiés depuis la page produit…"
                  @input=${(e: Event) => { text = (e.target as HTMLTextAreaElement).value; renderTpl() }}
                  .value=${text}></textarea>
      </div>

      <button id="import-extract-btn" class="primary" style="width:100%;margin-top:10px"
              ?disabled=${!text.trim() || loading}
              @click=${handleExtract}>
        ${loading ? '⏳ Extraction en cours…' : '✨ Extraire avec Gemini'}
      </button>
    </div>
  `, content)

  const handleExtract = async (): Promise<void> => {
    loading = true
    renderTpl()

    const { geminiApiKey } = getState()
    try {
      // Filter invalid URL before passing — only valid https/http URLs reach the service
      const validUrl = url && PURCHASE_URL_RE.test(url) ? url : undefined
      const result = await extractMoldingFromText(text, geminiApiKey, validUrl)
      // Do NOT close modal — onExtracted replaces #modal-content with the molding form
      onExtracted(result)
    } catch (err) {
      showToast((err as Error).message, 'error')
      loading = false
      renderTpl()
    }
  }

  renderTpl()
  modal.classList.remove('hidden')
}
```

- [ ] **Step 4: Run tests**

```bash
npm test src/ui/ImportModal.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/ImportModal.ts src/ui/ImportModal.test.ts
git commit -m "feat(ui): add ImportModal — paste product text, extract with Gemini"
```

---

## Chunk 3: SettingsModal + Wiring

### Task 6: `SettingsModal.ts`

**Files:**
- Create: `src/ui/SettingsModal.ts`
- Create: `src/ui/SettingsModal.test.ts`

**Important prerequisite:** Before writing this file, you need a Google Cloud project with an OAuth 2.0 client ID (type "Application web"). Authorized JavaScript origins must include `http://localhost:5173` (dev) and `https://<your-github-username>.github.io` (production). The client ID is a public value — paste it as `GOOGLE_CLIENT_ID` in the file. If you don't have one yet, set `GOOGLE_CLIENT_ID = ''` and the Google Sign-In button will be silently absent.

- [ ] **Step 1: Write the failing test** — create `src/ui/SettingsModal.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { produce } from 'immer'

vi.mock('../state/AppState.js', () => ({
  getState: vi.fn(() => ({ geminiApiKey: 'key-test', geminiModel: 'gemini-flash' })),
  setState: vi.fn(fn => fn({ geminiApiKey: '', geminiModel: 'gemini-flash', project: {} as any })),
}))
vi.mock('../state/storage.js', () => ({ saveGeminiKey: vi.fn() }))
vi.mock('./toast.js', () => ({ showToast: vi.fn() }))

import { showSettingsModal } from './SettingsModal.js'
import { getState, setState } from '../state/AppState.js'
import { saveGeminiKey } from '../state/storage.js'
import { showToast } from './toast.js'

function setupDOM(): void {
  document.body.innerHTML = `
    <div id="app-modal" class="hidden"></div>
    <div id="modal-content"></div>`
}

describe('showSettingsModal', () => {
  beforeEach(() => {
    setupDOM()
    vi.clearAllMocks()
  })

  it('ouvre le modal', () => {
    showSettingsModal()
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(false)
  })

  it('affiche la clé API existante dans le champ password', () => {
    showSettingsModal()
    const input = document.getElementById('setting-gemini-key') as HTMLInputElement
    expect(input.value).toBe('key-test')
  })

  it('sauvegarde la clé API et le modèle au clic Enregistrer', () => {
    showSettingsModal()
    const keyInput = document.getElementById('setting-gemini-key') as HTMLInputElement
    keyInput.value = 'new-key-456'
    const modelSelect = document.getElementById('setting-gemini-model') as HTMLSelectElement
    modelSelect.value = 'imagen-4'

    document.getElementById('settings-save')?.click()

    expect(saveGeminiKey).toHaveBeenCalledWith('new-key-456')
    expect(setState).toHaveBeenCalledOnce()
    // Verify the updater writes the correct payload
    const [updaterFn] = vi.mocked(setState).mock.calls[0]
    const prev = { geminiApiKey: '', geminiModel: 'gemini-flash' as 'gemini-flash' | 'imagen-4' }
    expect(updaterFn(prev)).toMatchObject({ geminiApiKey: 'new-key-456', geminiModel: 'imagen-4' })
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('sauvegardés'))
  })

  it('ferme le modal après sauvegarde', () => {
    showSettingsModal()
    document.getElementById('settings-save')?.click()
    expect(document.getElementById('app-modal')!.classList.contains('hidden')).toBe(true)
  })

  it('le sélecteur de modèle Gemini est présent avec la valeur correcte', () => {
    showSettingsModal()
    const select = document.getElementById('setting-gemini-model') as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(select.value).toBe('gemini-flash')
  })

  it('sans GIS disponible — le champ clé API fonctionne normalement', () => {
    // Ensure google is not defined (jsdom default)
    showSettingsModal()
    const input = document.getElementById('setting-gemini-key') as HTMLInputElement
    expect(input).not.toBeNull()
    // GOOGLE_CLIENT_ID = '' → no Google Sign-In button rendered
    expect(document.getElementById('google-signin-btn')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test src/ui/SettingsModal.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/ui/SettingsModal.ts`**

```typescript
import { html, render } from 'lit-html'
import type { TemplateResult } from 'lit-html'
import { produce } from 'immer'
import { getState, setState } from '../state/AppState.js'
import { saveGeminiKey } from '../state/storage.js'
import { showToast } from './toast.js'

// Public OAuth 2.0 client ID — non-secret, safe to commit.
// Create yours at console.cloud.google.com → APIs & Services → Credentials
// Add JavaScript origins: http://localhost:5173 and https://<username>.github.io
const GOOGLE_CLIENT_ID = ''  // ← paste your client ID here

interface GoogleUser {
  name: string
  email: string
  picture?: string
}

// Persisted across modal open/close in the same page session
let googleUser: GoogleUser | null = null

export function showSettingsModal(): void {
  const modalContent = document.getElementById('modal-content')
  const appModal = document.getElementById('app-modal')
  if (!modalContent || !appModal) return

  const renderTpl = (): void => {
    // Re-read state on every render so re-opened modal always shows current values
    const { geminiApiKey, geminiModel } = getState()
    render(buildTpl(geminiApiKey, geminiModel, appModal, renderTpl), modalContent)
  }

  renderTpl()
  appModal.classList.remove('hidden')

  // Attempt to render Google Sign-In button (silently fails if GIS not loaded)
  initGoogleSignIn(renderTpl)
}

function buildTpl(
  apiKey: string,
  model: string,
  appModal: HTMLElement,
  renderTpl: () => void,
): TemplateResult {
  const handleSave = (): void => {
    const key   = (document.getElementById('setting-gemini-key')   as HTMLInputElement).value
    const raw   = (document.getElementById('setting-gemini-model') as HTMLSelectElement).value
    const m: 'gemini-flash' | 'imagen-4' = raw === 'imagen-4' ? 'imagen-4' : 'gemini-flash'
    saveGeminiKey(key)
    setState(s => produce(s, draft => { draft.geminiApiKey = key; draft.geminiModel = m }))
    appModal.classList.add('hidden')
    showToast('✓ Paramètres sauvegardés')
  }

  const handleSignOut = (): void => {
    googleUser = null
    renderTpl()
  }

  return html`
    <div style="min-width:280px">
      <h3 style="margin-bottom:12px">⚙️ Paramètres</h3>

      ${googleUser ? html`
        <div class="google-profile">
          ${googleUser.picture ? html`<img src=${googleUser.picture} class="google-avatar" alt="" />` : ''}
          <div class="google-profile__info">
            <div class="google-profile__name">${googleUser.name}</div>
            <div class="google-profile__email">${googleUser.email}</div>
          </div>
          <button @click=${handleSignOut}>Se déconnecter</button>
        </div>
        ` : GOOGLE_CLIENT_ID ? html`
        <div id="google-signin-btn"></div>
        <div class="settings-separator">── ou ──</div>
        ` : ''}

      <div class="field">
        <label>Clé API Gemini</label>
        <input type="password" id="setting-gemini-key" .value=${apiKey}
               placeholder="AIza…" style="width:100%" />
        ${googleUser ? html`
          <small style="color:var(--text-muted)">
            Pas encore de clé ? →
            <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer"
               style="color:var(--accent)">Obtenir ma clé gratuite</a>
            (connectez-vous avec le même compte Google)
          </small>` : html`
          <small style="color:var(--text-muted)">
            Obtenez votre clé sur
            <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer"
               style="color:var(--accent)">aistudio.google.com</a>
          </small>`}
      </div>

      <div class="field">
        <label>Modèle Gemini</label>
        <select id="setting-gemini-model" style="width:100%" .value=${model}>
          <option value="gemini-flash">Gemini Flash (gratuit)</option>
          <option value="imagen-4">Imagen 4 (haute qualité)</option>
        </select>
      </div>

      <button id="settings-save" class="primary"
              style="width:100%;margin-top:10px" @click=${handleSave}>
        Enregistrer
      </button>
    </div>`
}

// ── Google Identity Services ──────────────────────────────────────────────────

type GisCallback = (response: { credential: string }) => void

declare const google: {
  accounts: { id: { initialize: (opts: object) => void; renderButton: (el: Element, opts: object) => void } }
} | undefined

function initGoogleSignIn(rerender: () => void): void {
  if (!GOOGLE_CLIENT_ID) return
  if (typeof google === 'undefined' || !google?.accounts?.id) return
  if (googleUser) return  // already signed in

  const btnEl = document.getElementById('google-signin-btn')
  if (!btnEl) return

  const callback: GisCallback = ({ credential }) => {
    googleUser = parseJwt(credential)
    rerender()
  }

  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback })
  google.accounts.id.renderButton(btnEl, { type: 'standard', text: 'signin_with', locale: 'fr' })
}

function parseJwt(token: string): GoogleUser {
  try {
    const raw = token.split('.')[1]!
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    // JWT strips trailing '=' padding — add it back for atob compatibility
    const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=')
    const json = atob(padded)
    const payload = JSON.parse(json) as { name: string; email: string; picture?: string }
    return { name: payload.name, email: payload.email, picture: payload.picture }
  } catch {
    // Malformed token — fail gracefully rather than crashing the GIS callback
    return { name: 'Utilisateur Google', email: '' }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test src/ui/SettingsModal.test.ts
```

Expected: all 6 tests PASS.

**Note on the model selector:** lit-html's `.value=${model}` binding on `<select>` requires the options to already be in the DOM. In jsdom this works correctly. If the selected option doesn't appear correct in the browser, use `@change` to read `select.value` (which is already what `handleSave` does).

- [ ] **Step 5: Commit**

```bash
git add src/ui/SettingsModal.ts src/ui/SettingsModal.test.ts
git commit -m "feat(ui): add SettingsModal with Google Sign-In guide"
```

---

### Task 7: Wire `index.ts` and `index.html`

**Files:**
- Modify: `src/index.ts`
- Modify: `index.html`

- [ ] **Step 1: Add GIS script tag to `index.html`**

In `index.html`, add before the closing `</head>` tag:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

- [ ] **Step 2: Replace inline `showSettingsModal` in `src/index.ts`**

Add this import at the top of `src/index.ts` (with other UI imports):

```typescript
import { showSettingsModal } from './ui/SettingsModal.js'
```

Delete the entire `showSettingsModal()` function from `src/index.ts` (lines 172–206 in the original file — from `function showSettingsModal(): void {` to the closing `}`). The function is now imported.

**Note on `h` import:** After removing `showSettingsModal`, check whether `src/index.ts` still references `h` from `'./utils/h.js'`. The existing `showImageModal` builds its content via `innerHTML`, and `showSettingsModal` is the only caller of `h(geminiApiKey)` (currently line 184). Once `showSettingsModal` is deleted, `import { h } from './utils/h.js'` will become unused — remove it. `npx tsc --noEmit` will flag unused imports if `noUnusedLocals` is enabled in `tsconfig.json`.

- [ ] **Step 3: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts index.html
git commit -m "feat: wire SettingsModal import, add GIS script to index.html"
```

---

## Chunk 4: MoldingsPanel Integration

### Task 8: Integrate all features into `MoldingsPanel.ts`

**Files:**
- Modify: `src/ui/MoldingsPanel.ts`
- Modify: `src/ui/MoldingsPanel.test.ts`
- Modify: `src/style.css`

- [ ] **Step 1: Write the new failing tests** — append to `src/ui/MoldingsPanel.test.ts`:

**Note:** `emptyProject` is defined at line 21 of the existing test file in the outer describe scope — it is accessible to all subsequently appended `describe` blocks without any extra import.

```typescript
// ─── NEW: Purchase URL & Material ────────────────────────────────────────────
describe('molding list — buy buttons', () => {
  const projectWithLink = {
    ...emptyProject,
    moldings: [
      {
        id: 'm1', name: 'Baroque', reference: 'REF1',
        width: 16, thickness: 29, barLength: 270, pricePerBar: 12,
        color: '#fff', purchaseUrl: 'https://amazon.fr/dp/B001',
      },
      {
        id: 'm2', name: 'Simple', reference: '',
        width: 10, thickness: 20, barLength: 200, pricePerBar: 5,
        color: '#fff',
        // no purchaseUrl
      },
    ],
    rosettes: [],
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="panel-content"></div>
      <div id="app-modal" class="hidden"></div>
      <div id="modal-content"></div>`
    vi.clearAllMocks()
    vi.mocked(getProject).mockReturnValue(projectWithLink as never)
  })

  it('moulure avec purchaseUrl → bouton 🛒 présent avec bonne URL', () => {
    const container = document.getElementById('panel-content')!
    litRender(MoldingsPanel(), container)
    const buyBtn = container.querySelector<HTMLAnchorElement>('a[href="https://amazon.fr/dp/B001"]')
    expect(buyBtn).not.toBeNull()
    expect(buyBtn!.textContent).toContain('🛒')
  })

  it('moulure sans purchaseUrl → bouton 🔍 Amazon présent', () => {
    const container = document.getElementById('panel-content')!
    litRender(MoldingsPanel(), container)
    const searchBtns = container.querySelectorAll('a[href*="amazon.fr/s"]')
    expect(searchBtns.length).toBeGreaterThanOrEqual(1)
    expect(searchBtns[0]!.textContent).toContain('🔍')
  })

  it('URL Amazon de recherche contient le nom et la référence', () => {
    const container = document.getElementById('panel-content')!
    litRender(MoldingsPanel(), container)
    const searchLinks = container.querySelectorAll<HTMLAnchorElement>('a[href*="amazon.fr/s"]')
    // m2 has no purchaseUrl so it should have a search link
    const m2Link = Array.from(searchLinks).find(a => a.href.includes('Simple'))
    expect(m2Link).not.toBeNull()
  })

  it('changement de matériau dans le formulaire → MaterialAdvisor s\'affiche', () => {
    const container = document.getElementById('panel-content')!
    litRender(MoldingsPanel(), container)

    // Click edit on the first molding (Baroque — no material set)
    const editBtn = container.querySelector<HTMLButtonElement>('li button:not(.danger)')
    editBtn!.click()

    const modalContent = document.getElementById('modal-content')!
    const select = modalContent.querySelector<HTMLSelectElement>('#mf-material')!
    expect(select).not.toBeNull()
    // No advisor card before selecting a material
    expect(modalContent.querySelector('.material-advisor')).toBeNull()

    // Select a material — fires @change handler → selectedMaterial updated → renderTpl() called
    select.value = 'wood'
    select.dispatchEvent(new Event('change'))

    // MaterialAdvisor should now be rendered
    expect(modalContent.querySelector('.material-advisor')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
npm test src/ui/MoldingsPanel.test.ts
```

Expected: new tests FAIL, existing tests still PASS.

- [ ] **Step 3: Update `src/ui/MoldingsPanel.ts`** — full rewrite incorporating all new features:

Add imports at the top:

```typescript
import { produce } from 'immer'
import { html, render } from 'lit-html'
import type { TemplateResult } from 'lit-html'
import { nanoid } from 'nanoid'
import { getProject, setState, undo } from '../state/AppState.js'
import { showToast } from './toast.js'
import { showImportModal } from './ImportModal.js'
import { MaterialAdvisor } from './MaterialAdvisor.js'
import { PURCHASE_URL_RE } from '../types/schemas.js'
import type { Molding, Rosette, MoldingMaterial } from '../types/index.js'
```

Add constant after imports:

```typescript
const MATERIAL_OPTIONS: { value: MoldingMaterial | ''; label: string }[] = [
  { value: '', label: '— Choisir —' },
  { value: 'wood', label: '🪵 Bois massif' },
  { value: 'mdf', label: '📋 MDF' },
  { value: 'pvc', label: '💧 PVC' },
  { value: 'polystyrene', label: '🫧 Polystyrène' },
  { value: 'polyurethane', label: '✨ Polyuréthane' },
  { value: 'other', label: '📦 Autre' },
]
```

Update `MoldingsPanel()` — add the import button and buy buttons to each molding:

```typescript
export function MoldingsPanel(): TemplateResult {
  const project = getProject()
  return html`
    <div class="section-title">Moulures</div>
    <ul class="panel-list">
      ${project.moldings.length === 0
        ? html`<li class="empty-hint"><strong>Aucune moulure</strong>Ajoutez les profils de moulures<br>disponibles dans votre stock.</li>`
        : project.moldings.map(m => html`
          <li>
            <span style="display:inline-block;width:12px;height:12px;background:${m.color};border-radius:2px;margin-right:6px"></span>
            <span>${m.name}</span>
            <small style="color:var(--text-muted)">${m.width}×${m.thickness}mm · ${m.barLength}cm · ${m.pricePerBar}€</small>
            <div class="actions">
              ${m.purchaseUrl
                ? html`<a href=${m.purchaseUrl} target="_blank" rel="noopener noreferrer"
                           class="btn-sm" title="Acheter">🛒</a>`
                : html`<a href=${generateAmazonUrl(m)} target="_blank" rel="noopener noreferrer"
                           class="btn-sm" title="Trouver sur Amazon">🔍</a>`}
              <button @click=${() => showMoldingModal(m)}>✏️</button>
              <button class="danger" @click=${() => {
                const moldingName = m.name
                setState(s => produce(s, draft => {
                  draft.project.moldings = draft.project.moldings.filter(x => x.id !== m.id)
                }))
                showToast(`Moulure "${moldingName}" supprimée`, 'success', { label: 'Annuler', onClick: undo })
              }}>🗑️</button>
            </div>
          </li>`)}
    </ul>
    <div style="display:flex;gap:6px;margin-top:6px">
      <button class="primary" style="flex:1" @click=${() => showMoldingModal()}>+ Ajouter moulure</button>
      <button style="flex:1" @click=${openImportModal}>⬇ Importer</button>
    </div>

    <div class="section-title" style="margin-top:16px">Rosettes d'angle</div>
    <ul class="panel-list">
      ${project.rosettes.length === 0
        ? html`<li class="empty-hint"><strong>Aucune rosette</strong>Les rosettes habillent les angles<br>de rencontre des cadres.</li>`
        : project.rosettes.map(r => html`
          <li>
            <span>${r.name}</span>
            <small style="color:var(--text-muted)">${r.size}cm · ${r.pricePerPiece}€/pce</small>
            <div class="actions">
              <button class="danger" @click=${() => {
                const rosetteName = r.name
                setState(s => produce(s, draft => {
                  draft.project.rosettes = draft.project.rosettes.filter(x => x.id !== r.id)
                }))
                showToast(`Rosette "${rosetteName}" supprimée`, 'success', { label: 'Annuler', onClick: undo })
              }}>🗑️</button>
            </div>
          </li>`)}
    </ul>
    <button style="width:100%;margin-top:6px" @click=${showRosetteModal}>+ Ajouter rosette</button>
  `
}
```

Add helper function:

```typescript
function generateAmazonUrl(m: Molding): string {
  const terms = [m.name, m.reference].filter(Boolean).join(' ')
  return `https://www.amazon.fr/s?k=${encodeURIComponent(terms + ' moulure')}`
}
```

Update `moldingFormTpl` to accept an optional `prefill` and include material + purchaseUrl fields:

```typescript
function moldingFormTpl(
  m: Molding | undefined,
  prefill: Partial<Molding> | undefined,
  currentMaterial: MoldingMaterial | '',
  onMaterialChange: (mat: MoldingMaterial | '') => void,
): TemplateResult {
  // m takes priority (edit mode); prefill provides defaults (import mode)
  const v = (key: keyof Molding, fallback: string) =>
    String(m?.[key] ?? prefill?.[key] ?? fallback)

  const existingId = m?.id

  return html`
    <div style="min-width:260px">
      <h3 style="margin-bottom:12px">${m ? 'Modifier' : 'Nouvelle'} moulure</h3>
      <div class="field"><label>Nom</label>
        <input type="text" id="mf-name" .value=${v('name', '')} /></div>
      <div class="field"><label>Référence</label>
        <input type="text" id="mf-ref" .value=${v('reference', '')} /></div>
      <div class="field-row">
        <div class="field"><label>Largeur (mm)</label>
          <input type="number" id="mf-width" .value=${v('width', '16')} min="1" /></div>
        <div class="field"><label>Épaisseur (mm)</label>
          <input type="number" id="mf-thick" .value=${v('thickness', '29')} min="1" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Longueur barre (cm)</label>
          <input type="number" id="mf-bar" .value=${v('barLength', '270')} min="10" /></div>
        <div class="field"><label>Prix/barre (€)</label>
          <input type="number" id="mf-price" .value=${v('pricePerBar', '0')} min="0" step="0.01" /></div>
      </div>
      <div class="field"><label>Couleur</label>
        <input type="color" id="mf-color" .value=${v('color', '#e8d5b0')} /></div>
      <div class="field"><label>Matériau</label>
        <select id="mf-material"
                @change=${(e: Event) => onMaterialChange((e.target as HTMLSelectElement).value as MoldingMaterial | '')}>
          ${MATERIAL_OPTIONS.map(opt => html`
            <option value=${opt.value} ?selected=${currentMaterial === opt.value}>${opt.label}</option>`)}
        </select></div>
      ${currentMaterial ? MaterialAdvisor(currentMaterial as MoldingMaterial) : ''}
      <div class="field"><label>Lien d'achat (optionnel)</label>
        <input type="text" id="mf-purchase-url"
               .value=${v('purchaseUrl', '')}
               placeholder="https://amazon.fr/dp/…" /></div>
      <button class="primary" style="margin-top:10px;width:100%"
              @click=${() => saveMolding(existingId)}>Enregistrer</button>
    </div>`
}
```

Update `showMoldingModal` signature:

```typescript
function showMoldingModal(m?: Molding, prefill?: Partial<Molding>): void {
  const content = document.getElementById('modal-content')
  const modal = document.getElementById('app-modal')
  if (!content || !modal) return

  // Stateful closure — re-renders when user changes the material dropdown
  let selectedMaterial: MoldingMaterial | '' = (m?.material ?? prefill?.material ?? '') as MoldingMaterial | ''
  const renderTpl = (): void =>
    render(moldingFormTpl(m, prefill, selectedMaterial, (mat) => {
      selectedMaterial = mat
      renderTpl()
    }), content)
  renderTpl()
  modal.classList.remove('hidden')
}
```

Update `saveMolding` to read and validate new fields:

```typescript
function saveMolding(existingId?: string): void {
  const purchaseUrlRaw = (document.getElementById('mf-purchase-url') as HTMLInputElement | null)?.value?.trim() ?? ''
  if (purchaseUrlRaw && !PURCHASE_URL_RE.test(purchaseUrlRaw)) {
    showToast('URL invalide — doit commencer par https:// ou http://', 'error')
    return
  }
  const purchaseUrl = purchaseUrlRaw || undefined
  const materialRaw = (document.getElementById('mf-material') as HTMLSelectElement | null)?.value ?? ''
  const material = materialRaw ? materialRaw as MoldingMaterial : undefined

  const molding: Molding = {
    id:          existingId ?? nanoid(),
    name:        (document.getElementById('mf-name')  as HTMLInputElement).value,
    reference:   (document.getElementById('mf-ref')   as HTMLInputElement).value,
    width:       Number((document.getElementById('mf-width') as HTMLInputElement).value),
    thickness:   Number((document.getElementById('mf-thick') as HTMLInputElement).value),
    barLength:   Number((document.getElementById('mf-bar')   as HTMLInputElement).value),
    pricePerBar: Number((document.getElementById('mf-price') as HTMLInputElement).value),
    color:       (document.getElementById('mf-color') as HTMLInputElement).value,
    ...(material    ? { material }    : {}),
    ...(purchaseUrl ? { purchaseUrl } : {}),
  }
  setState(s => produce(s, draft => {
    const idx = draft.project.moldings.findIndex(x => x.id === molding.id)
    if (idx >= 0) draft.project.moldings[idx] = molding
    else          draft.project.moldings.push(molding)
  }))
  const modal = document.getElementById('app-modal')
  modal?.classList.add('hidden')
}
```

Add `openImportModal` function:

```typescript
function openImportModal(): void {
  showImportModal((prefill) => {
    // Replace ImportModal content with the molding form (modal stays open)
    showMoldingModal(undefined, prefill)
  })
}
```

- [ ] **Step 4: Add CSS to `src/style.css`** — append at the end:

```css
/* ── Material Advisor ──────────────────────────────────────────────────── */
.material-advisor {
  margin: 6px 0 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.78rem;
}
.material-advisor__summary {
  padding: 6px 10px;
  cursor: pointer;
  font-weight: 600;
  user-select: none;
}
.material-advisor__body {
  padding: 6px 10px 10px;
}
.material-advisor__list {
  list-style: none;
  margin: 4px 0;
  padding: 0;
}
.material-advisor__list li {
  margin: 2px 0;
}
.material-advisor__meta {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 0.75rem;
}

/* ── Google Profile ────────────────────────────────────────────────────── */
.google-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0 12px;
}
.google-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}
.google-profile__name { font-weight: 600; font-size: 0.9rem; }
.google-profile__email { font-size: 0.78rem; color: var(--text-muted); }
.settings-separator {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8rem;
  margin: 8px 0;
}
```

- [ ] **Step 5: Run new tests**

```bash
npm test src/ui/MoldingsPanel.test.ts
```

Expected: all tests PASS (existing + new).

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Verify TypeScript build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/ui/MoldingsPanel.ts src/ui/MoldingsPanel.test.ts src/style.css
git commit -m "feat(ui): integrate material advisor, import, and buy links into MoldingsPanel"
```

---

## Final Verification

- [ ] Start dev server and manually test the complete flow:

```bash
npm run dev
```

Checklist:
- [ ] Add a molding manually — existing flow unchanged
- [ ] Click "⬇ Importer" — modal opens with URL + text area
- [ ] Paste product text (with or without valid URL) → click "✨ Extraire avec Gemini" → molding form opens pre-filled
- [ ] Select a material in the form → expert card appears below dropdown
- [ ] Save molding with `purchaseUrl` → 🛒 button appears in the list, opens the URL
- [ ] Molding without `purchaseUrl` → 🔍 button opens Amazon search
- [ ] Open ⚙️ Paramètres → SettingsModal opens, model selector visible, key saves correctly
- [ ] Old project JSON loads without errors (backward compatibility)

- [ ] **Final commit (if any manual fixes were needed)**

```bash
git add -A
git commit -m "fix: manual verification fixes"
```
