import { createContext, useContext } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import type { GeoPoint } from '../types/geo'

export interface VisualizationPoint extends GeoPoint {
  readonly id: string
  readonly label?: string
}

/** The geometry the active tool currently wants rendered on the map. */
export interface MapVisualization {
  readonly points: readonly VisualizationPoint[]
  readonly line?: readonly [GeoPoint, GeoPoint]
}

/** A pending "click the map to choose a point" interaction. */
export interface PickRequest {
  readonly target: string
  readonly label: string
  readonly onPick: (point: GeoPoint) => void
}

export interface MapWorkspaceValue {
  readonly map: LeafletMap | null
  readonly registerMap: (map: LeafletMap | null) => void
  readonly visualization: MapVisualization | null
  readonly setVisualization: (visualization: MapVisualization | null) => void
  readonly picking: PickRequest | null
  readonly startPicking: (request: PickRequest) => void
  readonly cancelPicking: () => void
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
