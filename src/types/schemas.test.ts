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
