import { lazy, Suspense } from 'react'
import type { ToolId } from '../../types/tools'
import { getToolById } from '../../types/tools'
import CoordinatesTool from './CoordinatesTool'

/**
 * The default tool is imported eagerly so the first paint does not wait on a
 * chunk fetch. The remaining panels are code-split: the UTM converter carries
 * `proj4`, which is the largest dependency that is not needed at startup, and
 * splitting the other tools keeps the initial bundle focused on the map.
 */
const DistanceTool = lazy(() => import('./DistanceTool'))
const BearingTool = lazy(() => import('./BearingTool'))
const UtmTool = lazy(() => import('./UtmTool'))
const PolygonAreaTool = lazy(() => import('./PolygonAreaTool'))
const PolylineLengthTool = lazy(() => import('./PolylineLengthTool'))
const GeoJsonTool = lazy(() => import('./GeoJsonTool'))

interface ToolContentProps {
  id: ToolId
}

function ToolLoading() {
  return (
    <div className="tool-loading" role="status">
      <span className="tool-loading__spinner" aria-hidden="true" />
      <span>Loading tool…</span>
    </div>
  )
}

function renderTool(id: ToolId) {
  switch (id) {
    case 'coordinates':
      return <CoordinatesTool />
    case 'distance':
      return <DistanceTool />
    case 'bearing':
      return <BearingTool />
    case 'utm-converter':
      return <UtmTool />
    case 'polygon-area':
      return <PolygonAreaTool />
    case 'polyline-length':
      return <PolylineLengthTool />
    case 'geojson':
      return <GeoJsonTool />
    default: {
      const tool = getToolById(id)
      return (
        <div className="tool-panel__note">
          <span className="tool-panel__note-tag">Coming in a later phase</span>
          <p className="tool-panel__note-text">{tool.placeholder}</p>
        </div>
      )
    }
  }
}

export default function ToolContent({ id }: ToolContentProps) {
  return <Suspense fallback={<ToolLoading />}>{renderTool(id)}</Suspense>
}
