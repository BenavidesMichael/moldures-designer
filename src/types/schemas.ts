import { z } from 'zod'

const ZoneLayoutSchema = z.object({
  frameCount:       z.number().int().min(0).max(20),
  marginTop:        z.number().min(0),
  marginBottom:     z.number().min(0),
  marginLeft:       z.number().min(0),
  marginRight:      z.number().min(0),
  gapBetweenFrames: z.number().min(0),
  customWidths:     z.array(z.number().min(0)),
  customHeights:    z.array(z.number().min(0)),
})

const NestedLevelSchema = z.object({
  offset:      z.number().min(0),
  moldingId:   z.string(),
  cornerStyle: z.enum(['miter', 'rosette']),
  rosetteId:   z.string().optional(),
})

const FrameSchema = z.object({
  id:           z.string(),
  moldingId:    z.string(),
  cornerStyle:  z.enum(['miter', 'rosette']),
  rosetteId:    z.string().optional(),
  nestedLevels: z.array(NestedLevelSchema),
})

const ZoneSchema = z.object({
  id:     z.string(),
  type:   z.enum(['top', 'bottom', 'full']),
  layout: ZoneLayoutSchema,
  frames: z.array(FrameSchema),
})

const ObstacleSchema = z.object({
  id:        z.string(),
  name:      z.string().max(100),
  type:      z.enum(['window', 'door', 'radiator', 'outlet', 'switch', 'fireplace', 'custom']),
  width:     z.number().min(1),
  height:    z.number().min(1),
  positionX: z.number().min(0),
  positionY: z.number().min(0),
  display:   z.object({
    transparent: z.boolean(),
    fillColor:   z.string().optional(),
    texture:     z.enum(['wood', 'glass', 'brick', 'metal']).optional(),
  }),
})

const WallSchema = z.object({
  id:                  z.string(),
  name:                z.string().max(100),
  dimensions:          z.object({ width: z.number().min(1), height: z.number().min(1), plinthHeight: z.number().min(0) }),
  zoneMode:            z.enum(['1zone', '2zones']),
  zones:               z.array(ZoneSchema),
  separator:           z.object({ positionPercent: z.number().min(0).max(100), visible: z.boolean(), moldingId: z.string() }).optional(),
  archivedBottomZone:  ZoneSchema.optional(),
  obstacles:           z.array(ObstacleSchema),
  colors:              z.object({ wall: z.string(), moldings: z.string(), plinth: z.string() }),
  showAnnotations:     z.boolean(),
})

const MoldingSchema = z.object({
  id:            z.string(),
  name:          z.string().max(100),
  reference:     z.string().max(50),
  width:         z.number().min(1).max(500),
  thickness:     z.number().min(1).max(500),
  barLength:     z.number().min(1),
  pricePerBar:   z.number().min(0),
  color:         z.string(),
})

const RosetteSchema = z.object({
  id:            z.string(),
  name:          z.string().max(100),
  reference:     z.string().max(50),
  size:          z.number().min(1),
  pricePerPiece: z.number().min(0),
})

export const ProjectSchema = z.object({
  id:            z.string(),
  version:       z.number().int().default(1),
  name:          z.string().max(200),
  createdAt:     z.string(),
  activeWallId:  z.string(),
  walls:         z.array(WallSchema).min(1),
  moldings:      z.array(MoldingSchema),
  rosettes:      z.array(RosetteSchema),
})

export type ProjectFromSchema = z.infer<typeof ProjectSchema>
