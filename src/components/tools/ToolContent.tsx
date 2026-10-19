import type { ToolId } from '../../types/tools'
import { getToolById } from '../../types/tools'
import CoordinatesTool from './CoordinatesTool'
import DistanceTool from './DistanceTool'
import BearingTool from './BearingTool'
import UtmTool from './UtmTool'
import PolygonAreaTool from './PolygonAreaTool'
import PolylineLengthTool from './PolylineLengthTool'
import GeoJsonTool from './GeoJsonTool'

interface ToolContentProps {
  id: ToolId
}

export default function ToolContent({ id }: ToolContentProps) {
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
