export const TOOL_IDS = [
  'coordinates',
  'distance',
  'bearing',
  'utm-converter',
  'polygon-area',
  'polyline-length',
  'geojson',
] as const

export type ToolId = (typeof TOOL_IDS)[number]

export interface ToolDefinition {
  readonly id: ToolId
  readonly name: string
  readonly shortName: string
  readonly description: string
  readonly placeholder: string
}

export const DEFAULT_TOOL_ID: ToolId = 'coordinates'

export const TOOL_REGISTRY: Record<ToolId, ToolDefinition> = {
  coordinates: {
    id: 'coordinates',
    name: 'Coordinates',
    shortName: 'Coords',
    description: 'Inspect and convert point coordinates.',
    placeholder:
      'Inspect a point on the map and convert between decimal degrees, degrees/minutes/seconds and projected formats.',
  },
  distance: {
    id: 'distance',
    name: 'Distance',
    shortName: 'Distance',
    description: 'Measure distance between two points.',
    placeholder:
      'Measure the geodesic distance between two points placed on the map.',
  },
  bearing: {
    id: 'bearing',
    name: 'Bearing',
    shortName: 'Bearing',
    description: 'Compute the bearing between two points.',
    placeholder:
      'Compute the forward and reverse bearing between two points on the map.',
  },
  'utm-converter': {
    id: 'utm-converter',
    name: 'UTM Converter',
    shortName: 'UTM',
    description: 'Convert geographic coordinates to UTM.',
    placeholder:
      'Convert latitude and longitude into UTM easting, northing and zone values.',
  },
  'polygon-area': {
    id: 'polygon-area',
    name: 'Polygon Area',
    shortName: 'Area',
    description: 'Measure the area of a polygon.',
    placeholder:
      'Calculate the area of a polygon drawn on the map, reported in metric units.',
  },
  'polyline-length': {
    id: 'polyline-length',
    name: 'Polyline Length',
    shortName: 'Length',
    description: 'Measure the length of a polyline.',
    placeholder:
      'Calculate the total length of a polyline drawn on the map, reported in metric units.',
  },
  geojson: {
    id: 'geojson',
    name: 'GeoJSON',
    shortName: 'GeoJSON',
    description: 'Inspect or export GeoJSON.',
    placeholder:
      'Inspect geometry as GeoJSON and prepare it for export.',
  },
}

export const TOOLS: readonly ToolDefinition[] = TOOL_IDS.map(
  (id) => TOOL_REGISTRY[id],
)

export function getToolById(id: ToolId): ToolDefinition {
  return TOOL_REGISTRY[id]
}
