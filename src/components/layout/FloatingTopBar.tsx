import type { ToolDefinition } from '../../types/tools'

interface FloatingTopBarProps {
  activeTool: ToolDefinition
}

function GeoMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5v3M12 16v3M5 12h3M16 12h3" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function FloatingTopBar({ activeTool }: FloatingTopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar__brand">
        <span className="top-bar__mark" aria-hidden="true">
          <GeoMark />
        </span>
        <span className="top-bar__identity">
          <span className="top-bar__name">geo-toolbox</span>
          <span className="top-bar__label">Spatial Workspace</span>
        </span>
      </div>

      <div className="top-bar__meta">
        <span className="top-bar__tool">
          <span className="top-bar__tool-key">Tool</span>
          <span className="top-bar__tool-name">{activeTool.name}</span>
        </span>
        <span className="chip">WGS84 · EPSG:4326</span>
      </div>
    </header>
  )
}
