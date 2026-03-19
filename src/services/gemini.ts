import { GoogleGenAI } from '@google/genai'
import type { Project, Wall } from '../types/index.js'

export type GeminiModel = 'gemini-flash' | 'imagen-4'

const MODEL_IDS: Record<GeminiModel, string> = {
  'gemini-flash': 'gemini-2.0-flash-preview-image-generation',
  'imagen-4':     'imagen-4.0-generate-001',
}

const TIMEOUT_MS = 30_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new GeminiError('Délai dépassé. Réessayez.')), ms)
    ),
  ])
}

export async function generateWallRender(
  wall: Wall,
  project: Project,
  apiKey: string,
  model: GeminiModel = 'gemini-flash',
): Promise<string> {
  if (!apiKey) throw new GeminiError('Clé API manquante. Configurez-la dans ⚙️ Paramètres.')

  const ai = new GoogleGenAI({ apiKey })
  const prompt = buildPrompt(wall, project)

  try {
    const generate = model === 'imagen-4'
      ? generateWithImagen(ai, prompt)
      : generateWithGeminiFlash(ai, prompt)
    return await withTimeout(generate, TIMEOUT_MS)
  } catch (err) {
    throw translateError(err)
  }
}

async function generateWithGeminiFlash(ai: GoogleGenAI, prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL_IDS['gemini-flash'],
    contents: [{ parts: [{ text: prompt }] }],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  })
  const parts = response.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data)
  if (!imagePart?.inlineData?.data) throw new GeminiError('Aucune image dans la réponse Gemini.')
  return imagePart.inlineData.data
}

async function generateWithImagen(ai: GoogleGenAI, prompt: string): Promise<string> {
  const response = await ai.models.generateImages({
    model: MODEL_IDS['imagen-4'],
    prompt,
    config: { numberOfImages: 1, aspectRatio: '16:9', includeRaiReason: true },
  })
  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes
  if (!imageBytes) throw new GeminiError('Aucune image dans la réponse Imagen.')
  return imageBytes
}

export function buildPrompt(wall: Wall, _project: Project): string {
  const obstacles = wall.obstacles.map(o => `${o.name} (${o.width}×${o.height}cm)`).join(', ')
  const zoneTop = wall.zones.find(z => z.type === 'top' || z.type === 'full')
  const zoneBot = wall.zones.find(z => z.type === 'bottom')
  const moldingColor = wall.colors.moldings || 'white'

  return [
    'Photorealistic interior wall, classical French Haussmann style.',
    `Wall: ${wall.dimensions.width}cm wide × ${wall.dimensions.height}cm tall.`,
    `Wall color: ${wall.colors.wall}. Molding color: ${moldingColor}.`,
    zoneTop ? `Upper zone with ${zoneTop.layout.frameCount} rectangular decorative molding frames.` : '',
    zoneBot ? `Lower zone with ${zoneBot.layout.frameCount} rectangular decorative molding frames.` : '',
    wall.separator?.visible ? `Horizontal rail separator at ${wall.separator.positionPercent}% height.` : '',
    obstacles ? `Wall elements: ${obstacles}.` : '',
    'Style: elegant classical interior, soft natural light, high quality render, 4K.',
  ].filter(Boolean).join(' ')
}

class GeminiError extends Error {
  constructor(message: string) { super(message); this.name = 'GeminiError' }
}

function translateError(err: unknown): GeminiError {
  if (err instanceof GeminiError) return err
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('401') || msg.includes('API_KEY')) return new GeminiError('Clé API invalide. Vérifiez vos paramètres.')
  if (msg.includes('429')) return new GeminiError('Quota Gemini atteint. Réessayez plus tard.')
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return new GeminiError('Connexion impossible. Vérifiez votre réseau.')
  return new GeminiError(`Erreur Gemini : ${msg}`)
}
// Note: GeminiError from withTimeout is caught by `err instanceof GeminiError` guard above and returned as-is.
