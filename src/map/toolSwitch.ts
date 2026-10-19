import type { ToolId } from '../types/tools'

/**
 * State-ownership rule for tool selection.
 *
 * The workspace provider owns the transient map state (`visualization`,
 * `picking` and `collecting`). Only an actual change of the active tool should
 * reset that state. Re-selecting the tool that is already active must leave the
 * map untouched, otherwise clicking the active dock button would, for example,
 * remove a drawn polygon from the map while the tool still believes it is
 * collecting vertices.
 *
 * Extracted as a pure function so the rule can be unit tested without a
 * browser or a React renderer.
 */
export interface ToolSwitchPlan {
  /** True when a different tool was selected. */
  readonly changed: boolean
  /** True when the provider's transient map state should be reset. */
  readonly resetsTransientState: boolean
}

export function planToolSwitch(current: ToolId, next: ToolId): ToolSwitchPlan {
  const changed = current !== next
  return { changed, resetsTransientState: changed }
}
