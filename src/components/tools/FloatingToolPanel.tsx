import type { ToolDefinition } from '../../types/tools'
import ToolContent from './ToolContent'
import ToolIcon from './ToolIcon'

interface FloatingToolPanelProps {
  tool: ToolDefinition
  isOpen: boolean
  onClose: () => void
}

export default function FloatingToolPanel({
  tool,
  isOpen,
  onClose,
}: FloatingToolPanelProps) {
  return (
    <section
      className="tool-panel"
      aria-label={`${tool.name} tool panel`}
      hidden={!isOpen}
    >
      <header className="tool-panel__header">
        <span className="tool-panel__icon" aria-hidden="true">
          <ToolIcon id={tool.id} />
        </span>
        <div className="tool-panel__titles">
          <span className="tool-panel__eyebrow">Active tool</span>
          <h2 className="tool-panel__title">{tool.name}</h2>
          <p className="tool-panel__description">{tool.description}</p>
        </div>
        <button
          type="button"
          className="tool-panel__close"
          aria-label={`Close ${tool.name} panel`}
          title="Close panel"
          onClick={onClose}
        >
          <svg
            viewBox="0 0 24 24"
            width={16}
            height={16}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </header>

      <div className="tool-panel__body">
        <ToolContent id={tool.id} />
      </div>
    </section>
  )
}
