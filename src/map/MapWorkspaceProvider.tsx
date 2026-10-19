import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import type { GeoPoint } from '../types/geo'
import { MapWorkspaceContext } from './workspace'
import type {
  MapVisualization,
  MapWorkspaceValue,
  PickRequest,
} from './workspace'

interface MapWorkspaceProviderProps {
  children: ReactNode
}

export default function MapWorkspaceProvider({
  children,
}: MapWorkspaceProviderProps) {
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [visualization, setVisualization] = useState<MapVisualization | null>(
    null,
  )
  const [picking, setPicking] = useState<PickRequest | null>(null)

  const registerMap = useCallback((instance: LeafletMap | null) => {
    setMap(instance)
  }, [])

  const startPicking = useCallback((request: PickRequest) => {
    setPicking(request)
  }, [])

  const cancelPicking = useCallback(() => {
    setPicking(null)
  }, [])

  const focusOn = useCallback(
    (point: GeoPoint) => {
      if (map === null) {
        return
      }
      map.setView([point.latitude, point.longitude], map.getZoom(), {
        animate: true,
      })
    },
    [map],
  )

  const value = useMemo<MapWorkspaceValue>(
    () => ({
      map,
      registerMap,
      visualization,
      setVisualization,
      picking,
      startPicking,
      cancelPicking,
      focusOn,
    }),
    [
      map,
      registerMap,
      visualization,
      picking,
      startPicking,
      cancelPicking,
      focusOn,
    ],
  )

  return (
    <MapWorkspaceContext.Provider value={value}>
      {children}
    </MapWorkspaceContext.Provider>
  )
}
