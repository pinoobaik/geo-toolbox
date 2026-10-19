import { useCallback, useMemo, useState } from 'react'
import FloatingTopBar from './components/layout/FloatingTopBar'
import FloatingToolPanel from './components/tools/FloatingToolPanel'
import ToolDock from './components/tools/ToolDock'
import MapView from './map/MapView'
import MapWorkspaceProvider from './map/MapWorkspaceProvider'
import { useMapWorkspace } from './map/workspace'
import { DEFAULT_TOOL_ID, getToolById } from './types/tools'
import type { ToolId } from './types/tools'
import './App.css'

function Workspace() {
  const { setVisualization, cancelPicking } = useMapWorkspace()
  const [activeToolId, setActiveToolId] = useState<ToolId>(DEFAULT_TOOL_ID)
  const [isPanelOpen, setIsPanelOpen] = useState(true)

  const activeTool = useMemo(() => getToolById(activeToolId), [activeToolId])

  const handleSelectTool = useCallback(
    (id: ToolId) => {
      setActiveToolId(id)
      setIsPanelOpen(true)
      setVisualization(null)
      cancelPicking()
    },
    [setVisualization, cancelPicking],
  )

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false)
  }, [])

  return (
    <div className="workspace">
      <MapView />
      <FloatingTopBar activeTool={activeTool} />
      <ToolDock activeToolId={activeToolId} onSelectTool={handleSelectTool} />
      <FloatingToolPanel
        tool={activeTool}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
      />
    </div>
  )
}

function App() {
  return (
    <MapWorkspaceProvider>
      <Workspace />
    </MapWorkspaceProvider>
  )
}

export default App
