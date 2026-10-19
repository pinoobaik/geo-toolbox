import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GeoPoint } from '../../types/geo'
import { computeBearing } from '../../core/bearing'
import CoordinatePair from '../ui/CoordinatePair'
import type { CoordinateErrors, CoordinateInput } from '../ui/CoordinatePair'
import { useMapWorkspace } from '../../map/workspace'
import {
  EMPTY_COORDINATE_INPUT,
  decimalAxisError,
  formatCoordinateInput,
  parseDecimalCoordinate,
} from './coordinateInput'

const PICK_PRECISION = 6

function axisErrors(input: CoordinateInput): CoordinateErrors {
  return {
    latitude: decimalAxisError(input.latitude, 'latitude'),
    longitude: decimalAxisError(input.longitude, 'longitude'),
  }
}

function formatAzimuth(value: number): string {
  return `${value.toFixed(2)}°`
}

export default function BearingTool() {
  const { setVisualization, startPicking, cancelPicking, picking } =
    useMapWorkspace()

  const [pointA, setPointA] = useState<CoordinateInput>(EMPTY_COORDINATE_INPUT)
  const [pointB, setPointB] = useState<CoordinateInput>(EMPTY_COORDINATE_INPUT)

  const valueA = useMemo(() => parseDecimalCoordinate(pointA), [pointA])
  const valueB = useMemo(() => parseDecimalCoordinate(pointB), [pointB])

  const errorsA = useMemo(() => axisErrors(pointA), [pointA])
  const errorsB = useMemo(() => axisErrors(pointB), [pointB])

  const bearing = useMemo(
    () => (valueA && valueB ? computeBearing(valueA, valueB) : null),
    [valueA, valueB],
  )

  const latitudeA = valueA?.latitude ?? null
  const longitudeA = valueA?.longitude ?? null
  const latitudeB = valueB?.latitude ?? null
  const longitudeB = valueB?.longitude ?? null

  useEffect(() => {
    if (
      latitudeA === null ||
      longitudeA === null ||
      latitudeB === null ||
      longitudeB === null
    ) {
      setVisualization(null)
      return
    }
    setVisualization({
      points: [
        { id: 'bearing-a', latitude: latitudeA, longitude: longitudeA, label: 'A' },
        { id: 'bearing-b', latitude: latitudeB, longitude: longitudeB, label: 'B' },
      ],
      line: [
        { latitude: latitudeA, longitude: longitudeA },
        { latitude: latitudeB, longitude: longitudeB },
      ],
    })
  }, [latitudeA, longitudeA, latitudeB, longitudeB, setVisualization])

  const target = picking?.target
  const isPickingA = target === 'bearing-a'
  const isPickingB = target === 'bearing-b'

  const startPick = useCallback(
    (which: 'a' | 'b') => {
      startPicking({
        target: which === 'a' ? 'bearing-a' : 'bearing-b',
        label: which === 'a' ? 'Point A' : 'Point B',
        onPick: (point: GeoPoint) => {
          const next = formatCoordinateInput(point, PICK_PRECISION)
          if (which === 'a') {
            setPointA(next)
          } else {
            setPointB(next)
          }
        },
      })
    },
    [startPicking],
  )

  const handleSwap = () => {
    setPointA(pointB)
    setPointB(pointA)
  }

  const renderPickControl = (which: 'a' | 'b', active: boolean) => {
    if (active) {
      return (
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={cancelPicking}
        >
          Cancel pick
        </button>
      )
    }
    return (
      <button
        type="button"
        className="button button--ghost button--small"
        onClick={() => startPick(which)}
        disabled={picking !== null}
      >
        Pick on map
      </button>
    )
  }

  return (
    <>
      {(isPickingA || isPickingB) ? (
        <div className="notice notice--pick" role="status">
          <span>
            Click the map to set {isPickingA ? 'Point A' : 'Point B'}.
          </span>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={cancelPicking}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <section className="tool-section" aria-label="Point A">
        <div className="tool-section__head">
          <h3 className="tool-section__title">Point A</h3>
          {renderPickControl('a', isPickingA)}
        </div>
        <CoordinatePair
          idPrefix="bearing-a"
          legend="Point A coordinates"
          value={pointA}
          errors={errorsA}
          onChange={setPointA}
        />
      </section>

      <section className="tool-section" aria-label="Point B">
        <div className="tool-section__head">
          <h3 className="tool-section__title">Point B</h3>
          {renderPickControl('b', isPickingB)}
        </div>
        <CoordinatePair
          idPrefix="bearing-b"
          legend="Point B coordinates"
          value={pointB}
          errors={errorsB}
          onChange={setPointB}
        />
      </section>

      <div className="button-row">
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={handleSwap}
        >
          Swap A / B
        </button>
      </div>

      <section className="tool-section" aria-label="Bearing results">
        <h3 className="tool-section__title">Bearings</h3>

        {bearing === null ? (
          <div className="empty-state">
            <p>
              Enter valid coordinates for both points, or pick them on the map,
              to calculate bearings.
            </p>
          </div>
        ) : !bearing.defined ? (
          <div className="notice notice--error" role="status">
            Bearing is undefined because both points are identical.
          </div>
        ) : (
          <dl className="result-list">
            <div className="result-list__row">
              <dt className="result-list__label">Initial bearing (A → B)</dt>
              <dd className="result-list__value">
                {formatAzimuth(bearing.value.initial)}
                <span className="result-list__cardinal">
                  {bearing.value.initialCardinal}
                </span>
              </dd>
            </div>
            <div className="result-list__row">
              <dt className="result-list__label">Final bearing (arrival at B)</dt>
              <dd className="result-list__value">
                {formatAzimuth(bearing.value.final)}
                <span className="result-list__cardinal">
                  {bearing.value.finalCardinal}
                </span>
              </dd>
            </div>
            <div className="result-list__row">
              <dt className="result-list__label">Reverse initial bearing (B → A)</dt>
              <dd className="result-list__value">
                {formatAzimuth(bearing.value.reverseInitial)}
                <span className="result-list__cardinal">
                  {bearing.value.reverseCardinal}
                </span>
              </dd>
            </div>
          </dl>
        )}

        <p className="tool-hint">
          Bearings use a spherical great-circle model. The final bearing is the
          heading on arrival at B and differs from the reverse initial bearing
          by 180°.
        </p>
      </section>
    </>
  )
}
