import { describe, expect, it } from 'vitest'
import { TOOL_IDS } from '../types/tools'
import { planToolSwitch } from './toolSwitch'

describe('planToolSwitch', () => {
  it('does not reset transient state when the active tool is re-selected', () => {
    for (const id of TOOL_IDS) {
      const plan = planToolSwitch(id, id)
      expect(plan.changed).toBe(false)
      expect(plan.resetsTransientState).toBe(false)
    }
  })

  it('resets transient state when a different tool is selected', () => {
    const plan = planToolSwitch('polygon-area', 'polyline-length')
    expect(plan.changed).toBe(true)
    expect(plan.resetsTransientState).toBe(true)
  })

  it('treats every distinct pair as a change', () => {
    for (const from of TOOL_IDS) {
      for (const to of TOOL_IDS) {
        const plan = planToolSwitch(from, to)
        expect(plan.changed).toBe(from !== to)
        expect(plan.resetsTransientState).toBe(from !== to)
      }
    }
  })
})
