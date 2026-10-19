import { describe, expect, it } from 'vitest'
import type { GeoPoint } from '../../types/geo'
import {
  DUPLICATE_VERTEX_TOLERANCE_DEG,
  appendVertex,
  isDuplicateOfLast,
} from './vertexList'

const A: GeoPoint = { latitude: 10, longitude: 20 }
const B: GeoPoint = { latitude: 10.0001, longitude: 20.0001 }

describe('isDuplicateOfLast', () => {
  it('is false for an empty list', () => {
    expect(isDuplicateOfLast([], A)).toBe(false)
  })

  it('detects an identical final vertex', () => {
    expect(isDuplicateOfLast([A], { ...A })).toBe(true)
    expect(isDuplicateOfLast([A, B], B)).toBe(true)
  })

  it('does not treat a distinct vertex as a duplicate', () => {
    expect(isDuplicateOfLast([A], B)).toBe(false)
  })

  it('uses a sub-millimetre tolerance', () => {
    expect(DUPLICATE_VERTEX_TOLERANCE_DEG).toBeLessThan(1e-6)
    const almost: GeoPoint = {
      latitude: A.latitude + DUPLICATE_VERTEX_TOLERANCE_DEG / 2,
      longitude: A.longitude,
    }
    expect(isDuplicateOfLast([A], almost)).toBe(true)
  })
})

describe('appendVertex', () => {
  it('appends a distinct vertex to a new array', () => {
    const result = appendVertex([A], B)
    expect(result).toEqual([A, B])
  })

  it('appends the first vertex', () => {
    expect(appendVertex([], A)).toEqual([A])
  })

  it('ignores an exact repeat and returns the same reference', () => {
    const vertices: GeoPoint[] = [A, B]
    const result = appendVertex(vertices, { ...B })
    expect(result).toBe(vertices)
    expect(result).toHaveLength(2)
  })

  it('allows revisiting an earlier (non-final) vertex', () => {
    const result = appendVertex([A, B], A)
    expect(result).toEqual([A, B, A])
  })

  it('does not mutate the input array', () => {
    const vertices: GeoPoint[] = [A]
    appendVertex(vertices, B)
    expect(vertices).toEqual([A])
  })
})
