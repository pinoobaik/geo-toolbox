import { createContext, useContext } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import type { GeoPoint } from '../types/geo'
import type { GeoJsonDataset } from '../core/geojson'

export interface VisualizationPoint extends GeoPoint {
  readonly id: string
  readonly label?: string
  /** When provided, clicking the marker removes the vertex. */
  readonly onRemove?: () => void
}

export interface MapPolygon {
  readonly ring: readonly GeoPoint[]
  readonly holes?: readonly (readonly GeoPoint[])[]
  /** True once there are enough vertices to close the outline. */
  readonly closed: boolean
}

/** The geometry the active tool currently wants rendered on the map. */
export interface MapVisualization {
  readonly points: readonly VisualizationPoint[]
  readonly line?: readonly GeoPoint[]
  readonly polygon?: MapPolygon
}

/** A pending single "click the map to choose a point" interaction. */
export interface PickRequest {
  readonly target: string
  readonly label: string
  readonly onPick: (point: GeoPoint) => void
}

/**
 * A continuous "click the map to add a vertex" interaction used by the drawing
 * tools. Unlike a PickRequest it stays active until explicitly stopped.
 */
export interface CollectionRequest {
  readonly target: string
  readonly label: string
  readonly onVertex: (point: GeoPoint) => void
}

export interface MapWorkspaceValue {
  readonly map: LeafletMap | null
  readonly registerMap: (map: LeafletMap | null) => void
  readonly visualization: MapVisualization | null
  readonly setVisualization: (visualization: MapVisualization | null) => void
  readonly picking: PickRequest | null
  readonly startPicking: (request: PickRequest) => void
  readonly cancelPicking: () => void
  readonly collecting: CollectionRequest | null
  readonly startCollecting: (request: CollectionRequest) => void
  readonly stopCollecting: () => void
  /**
   * Imported GeoJSON, kept separate from the transient measurement
   * `visualization` so importing a file never overwrites an active drawing.
   */
  readonly geoJson: GeoJsonDataset | null
  readonly setGeoJson: (dataset: GeoJsonDataset | null) => void
  /** Index of the selected imported entry, or null when nothing is selected. */
  readonly selectedGeoJsonEntry: number | null
  readonly setSelectedGeoJsonEntry: (index: number | null) => void
  readonly focusOn: (point: GeoPoint) => void
}

export const MapWorkspaceContext = createContext<MapWorkspaceValue | null>(null)

export function useMapWorkspace(): MapWorkspaceValue {
  const value = useContext(MapWorkspaceContext)
  if (value === null) {
    throw new Error('useMapWorkspace must be used within a MapWorkspaceProvider')
  }
  return value
}
