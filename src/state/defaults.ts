import { nanoid } from 'nanoid'
import type { Project, Zone, ZoneLayout, Molding } from '../types/index.js'

export function makeDefaultZoneLayout(frameCount = 2): ZoneLayout {
  return {
    frameCount,
    marginTop: 15,
    marginBottom: 15,
    marginLeft: 20,
    marginRight: 20,
    gapBetweenFrames: 10,
    customWidths: Array(frameCount).fill(0),
    customHeights: Array(frameCount).fill(0),
  }
}

// makeDefaultZone : pour créer de nouvelles zones dynamiquement (IDs aléatoires)
export function makeDefaultZone(type: Zone['type'] = 'full', frameCount = 2): Zone {
  const layout = makeDefaultZoneLayout(frameCount)
  return {
    id: nanoid(),
    type,
    layout,
    frames: Array.from({ length: frameCount }, () => ({
      id: nanoid(),
      moldingId: 'm1',
      cornerStyle: 'miter' as const,
      nestedLevels: [],
    })),
  }
}

export const DEFAULT_MOLDING: Molding = {
  id: 'm1',
  name: 'Pin PEFC 16×29mm',
  reference: 'PIN-16-29-270',
  width: 16,
  thickness: 29,
  barLength: 270,
  pricePerBar: 4.50,
  color: '#e8d5b0',
}

// makeDefaultProject : IDs fixes pour reproductibilité (premier démarrage + tests)
export function makeDefaultProject(): Project {
  return {
    id: 'proj-default',
    version: 1,
    name: 'Mon projet',
    createdAt: new Date().toISOString(),
    activeWallId: 'wall-1',
    moldings: [{ ...DEFAULT_MOLDING }],
    rosettes: [],
    walls: [{
      id: 'wall-1',
      name: 'Mur principal',
      dimensions: { width: 400, height: 250, plinthHeight: 10 },
      zoneMode: '1zone',
      zones: [{
        id: 'zone-1',
        type: 'full',
        layout: makeDefaultZoneLayout(2),
        frames: [
          { id: nanoid(), moldingId: 'm1', cornerStyle: 'miter', nestedLevels: [] },
          { id: nanoid(), moldingId: 'm1', cornerStyle: 'miter', nestedLevels: [] },
        ],
      }],
      obstacles: [],
      colors: { wall: '#f5f0e8', moldings: '', plinth: '#ffffff' },
      showAnnotations: true,
    }],
  }
}
