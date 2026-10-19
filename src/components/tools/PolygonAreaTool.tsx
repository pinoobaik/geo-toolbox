import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GeoPoint } from '../../types/geo'
import { useMapWorkspace } from '../../map/workspace'
import {
  areaUnitLabel,
  areaUnitPrecision,
  areaUnitSymbol,
  computePolygonArea,
  convertArea,
} from '../../core/polygonArea'
import type { AreaUnit } from '../../core/polygonArea'

const AREA_UNITS: readonly AreaUnit[] = ['m2', 'ha', 'km2', 'ac']

function formatPerimeter(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(3)} km`
  }
  return `${meters.toFixed(1)} m`
}

export default function PolygonAreaTool() {
  const { setVisualization, startCollecting, stopCollecting } = useMapWorkspace()

  const [vertices, setVertices] = useState<GeoPoint[]>([])
  const [isCollecting, setIsCollecting] = useState(true)
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('ha')

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
      target: 'polygon-area',
      label: 'Polygon vertex',
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
        id: `polygon-vertex-${index}`,
        latitude: vertex.latitude,
        longitude: vertex.longitude,
        label: String(index + 1),
        onRemove: () => removeVertex(index),
      })),
      polygon: {
        ring: vertices,
        closed: vertices.length >= 3,
      },
    })
  }, [vertices, setVisualization, removeVertex])

  const result = useMemo(
    () =>
      vertices.length >= 3
        ? computePolygonArea({ outer: { points: vertices } })
        : null,
    [vertices],
  )

  const formattedArea =
    result && result.ok
      ? convertArea(result.areaM2, areaUnit).toFixed(areaUnitPrecision(areaUnit))
      : ''

  return (
    <>
      {isCollecting ? (
        <div className="notice notice--pick" role="status">
          <span>Click the map to add polygon vertices.</span>
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

      <section className="tool-section" aria-label="Polygon area result">
        <div className="tool-section__head">
          <h3 className="tool-section__title">Area</h3>
          <span className="chip">{vertices.length} vertices</span>
        </div>

        {result === null ? (
          <div className="empty-state">
            <p>
              Add at least 3 vertices on the map to measure a polygon. Click a
              vertex to remove it.
            </p>
          </div>
        ) : !result.ok ? (
          <div className="notice notice--error" role="status">
            {result.error}
          </div>
        ) : (
          <>
            <div className="distance-result">
              <span className="distance-result__value">{formattedArea}</span>
              <span className="distance-result__unit">
                {areaUnitSymbol(areaUnit)}
              </span>
            </div>

            <div className="control-row">
              <label className="control-row__label" htmlFor="polygon-area-unit">
                Area unit
              </label>
              <select
                id="polygon-area-unit"
                className="select"
                value={areaUnit}
                onChange={(event) => {
                  const next = AREA_UNITS.find(
                    (unit) => unit === event.target.value,
                  )
                  if (next) {
                    setAreaUnit(next)
                  }
                }}
              >
                {AREA_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {areaUnitLabel(unit)} ({areaUnitSymbol(unit)})
                  </option>
                ))}
              </select>
            </div>

            <dl className="result-list">
              <div className="result-list__row">
                <dt className="result-list__label">Perimeter</dt>
                <dd className="result-list__value">
                  {formatPerimeter(result.perimeterM)}
                </dd>
              </div>
              <div className="result-list__row">
                <dt className="result-list__label">Area</dt>
                <dd className="result-list__value">
                  {formattedArea} {areaUnitSymbol(areaUnit)}
                </dd>
              </div>
            </dl>

            {result.selfIntersecting ? (
              <p className="notice notice--warning" role="status">
                This polygon appears to self-intersect; the measured area may be
                unreliable.
              </p>
            ) : null}
            {result.antimeridianWarning ? (
              <p className="notice notice--warning" role="status">
                An edge spans more than 180° of longitude. Area across the
                antimeridian may be inaccurate.
              </p>
            ) : null}
          </>
        )}
      </section>
    </>
  )
}
