import { useCallback, useMemo, useState } from 'react'
import FloatingTopBar from './components/layout/FloatingTopBar'
import FloatingToolPanel from './components/tools/FloatingToolPanel'
import ToolDock from './components/tools/ToolDock'
import MapView from './map/MapView'
import { DEFAULT_TOOL_ID, getToolById } from './types/tools'
import type { ToolId } from './types/tools'
import './App.css'

function App() {
  const [activeToolId, setActiveToolId] = useState<ToolId>(DEFAULT_TOOL_ID)
  const [isPanelOpen, setIsPanelOpen] = useState(true)

  const activeTool = useMemo(() => getToolById(activeToolId), [activeToolId])

  const handleSelectTool = useCallback((id: ToolId) => {
    setActiveToolId(id)
    setIsPanelOpen(true)
  }, [])

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false)
  }, [])

  return (
    <div className="workspace">
      <MapView />
      <FloatingTopBar activeTool={activeTool} />
      <ToolDock activeToolId={activeToolId} onSelectTool={handleSelectTool} />
      {isPanelOpen ? (
        <FloatingToolPanel tool={activeTool} onClose={handleClosePanel} />
      ) : null}
    </div>
  )
}

export default App
