import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GeoPoint } from '../../types/geo'
import { useMapWorkspace } from '../../map/workspace'
import { DISTANCE_UNITS, convertDistance, getDistanceUnit } from '../../core/distance'
import type { DistanceUnit } from '../../core/distance'
import {
  computePolylineLength,
  formatLength,
} from '../../core/polylineLength'
import { formatDecimalDegrees } from '../../core/coordinates'

const COORD_PRECISION = 5

export default function PolylineLengthTool() {
  const { setVisualization, startCollecting, stopCollecting } = useMapWorkspace()

  const [vertices, setVertices] = useState<GeoPoint[]>([])
  const [isCollecting, setIsCollecting] = useState(true)
  const [unit, setUnit] = useState<DistanceUnit>('kilometers')

  const addVertex = useCallback((point: GeoPoint) => {
    setVertices((previous) => [...previous, point])
  }, [])

  const removeVertex = useCallback((index: number) => {
    setVertices((previous) => previous.filter((_, i) => i !== index))
  }, [])

  const removeLast = useCallback(() => {
    setVertices((previous) => previous.slice(0, -1))
  }, [])

  const clear = useCallback(() => {
    setVertices([])
  }, [])

  useEffect(() => {
    if (!isCollecting) {
      return
    }
    startCollecting({
      target: 'polyline-length',
      label: 'Polyline vertex',
      onVertex: addVertex,
    })
    return () => {
      stopCollecting()
    }
  }, [isCollecting, startCollecting, stopCollecting, addVertex])

  useEffect(() => {
    if (vertices.length === 0) {
      setVisualization(null)
      return
    }
    setVisualization({
      points: vertices.map((vertex, index) => ({
        id: `polyline-vertex-${index}`,
        latitude: vertex.latitude,
        longitude: vertex.longitude,
        label: String(index + 1),
        onRemove: () => removeVertex(index),
      })),
      line: vertices,
    })
  }, [vertices, setVisualization, removeVertex])

  const result = useMemo(
    () => (vertices.length >= 2 ? computePolylineLength(vertices) : null),
    [vertices],
  )

  const unitOption = getDistanceUnit(unit)
  const totalValue =
    result && result.ok
      ? convertDistance(result.totalKm, unit).toFixed(unitOption.precision)
      : ''

  return (
    <>
      {isCollecting ? (
        <div className="notice notice--pick" role="status">
          <span>Click the map to add polyline vertices.</span>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => setIsCollecting(false)}
          >
            Pause
          </button>
        </div>
      ) : (
        <div className="notice" role="status">
          <span>Drawing paused. Resume to add more vertices.</span>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => setIsCollecting(true)}
          >
            Resume
          </button>
        </div>
      )}

      <div className="button-row">
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={removeLast}
          disabled={vertices.length === 0}
        >
          Remove last
        </button>
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={clear}
          disabled={vertices.length === 0}
        >
          Clear
        </button>
      </div>

      <section className="tool-section" aria-label="Polyline length result">
        <div className="tool-section__head">
          <h3 className="tool-section__title">Total length</h3>
          <span className="chip">{vertices.length} vertices</span>
        </div>

        {result === null ? (
          <div className="empty-state">
            <p>
              Add at least 2 vertices on the map to measure a polyline. Click a
              vertex to remove it.
            </p>
          </div>
        ) : !result.ok ? (
          <div className="notice notice--error" role="status">
            {result.error}
          </div>
        ) : (
          <>
            <div className="distance-result" aria-live="polite">
              <span className="distance-result__value">{totalValue}</span>
              <span className="distance-result__unit">
                {unitOption.symbol}
              </span>
            </div>

            <div className="control-row">
              <label className="control-row__label" htmlFor="polyline-unit">
                Unit
              </label>
              <select
                id="polyline-unit"
                className="select"
                value={unit}
                onChange={(event) => {
                  const next = DISTANCE_UNITS.find(
                    (option) => option.id === event.target.value,
                  )
                  if (next) {
                    setUnit(next.id)
                  }
                }}
              >
                {DISTANCE_UNITS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} ({option.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="table-scroll">
              <table className="segment-table">
                <caption className="visually-hidden">
                  Polyline segments and their lengths
                </caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col">Length</th>
                  </tr>
                </thead>
                <tbody>
                  {result.segments.map((segment) => (
                    <tr key={segment.index}>
                      <td>{segment.index}</td>
                      <td className="mono">
                        {formatDecimalDegrees(segment.from.latitude, COORD_PRECISION)},{' '}
                        {formatDecimalDegrees(segment.from.longitude, COORD_PRECISION)}
                      </td>
                      <td className="mono">
                        {formatDecimalDegrees(segment.to.latitude, COORD_PRECISION)},{' '}
                        {formatDecimalDegrees(segment.to.longitude, COORD_PRECISION)}
                      </td>
                      <td className="mono">
                        {formatLength(segment.lengthM, unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  )
}
