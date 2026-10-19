import { TOOLS } from '../../types/tools'
import type { ToolId } from '../../types/tools'
import ToolIcon from './ToolIcon'

interface ToolDockProps {
  activeToolId: ToolId
  onSelectTool: (id: ToolId) => void
}

export default function ToolDock({
  activeToolId,
  onSelectTool,
}: ToolDockProps) {
  return (
    <nav className="tool-dock" aria-label="GIS tools">
      {TOOLS.map((tool) => {
        const isActive = tool.id === activeToolId
        return (
          <button
            key={tool.id}
            type="button"
            className="tool-dock__button"
            aria-label={tool.name}
            aria-pressed={isActive}
            title={`${tool.name} — ${tool.description}`}
            onClick={() => onSelectTool(tool.id)}
          >
            <ToolIcon id={tool.id} />
            <span className="tool-dock__short" aria-hidden="true">
              {tool.shortName}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
