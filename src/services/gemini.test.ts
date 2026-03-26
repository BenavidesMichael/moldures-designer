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

  it('attache purchaseUrl quand une URL https valide est fournie', async () => {
    mockGenerateContent.mockResolvedValueOnce(makeResponse(JSON.stringify({
      name: 'Moulure', material: 'wood', width: 16,
      thickness: null, barLength: null, pricePerBar: null, reference: null,
    })))

    const result = await extractMoldingFromText('texte', 'AIza-test', 'https://shop.example.com')
    expect(result.purchaseUrl).toBe('https://shop.example.com')
  })

  it('rejette les URLs non-https — purchaseUrl absent du résultat', async () => {
    mockGenerateContent.mockResolvedValueOnce(makeResponse(JSON.stringify({
      name: 'Moulure', material: null, width: null,
      thickness: null, barLength: null, pricePerBar: null, reference: null,
    })))

    const result = await extractMoldingFromText('texte', 'AIza-test', 'ftp://example.com')
    expect('purchaseUrl' in result).toBe(false)
  })
})
