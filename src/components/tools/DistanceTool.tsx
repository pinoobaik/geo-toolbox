import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GeoPoint } from '../../types/geo'
import {
  DISTANCE_UNITS,
  convertDistance,
  getDistanceUnit,
  haversineDistanceKm,
} from '../../core/distance'
import type { DistanceUnit } from '../../core/distance'
import CoordinatePair from '../ui/CoordinatePair'
import type { CoordinateErrors, CoordinateInput } from '../ui/CoordinatePair'
import CopyButton from '../ui/CopyButton'
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

export default function DistanceTool() {
  const { setVisualization, startPicking, cancelPicking, picking } =
    useMapWorkspace()

  const [pointA, setPointA] = useState<CoordinateInput>(EMPTY_COORDINATE_INPUT)
  const [pointB, setPointB] = useState<CoordinateInput>(EMPTY_COORDINATE_INPUT)
  const [unit, setUnit] = useState<DistanceUnit>('kilometers')

  const valueA = useMemo(() => parseDecimalCoordinate(pointA), [pointA])
  const valueB = useMemo(() => parseDecimalCoordinate(pointB), [pointB])

  const errorsA = useMemo(() => axisErrors(pointA), [pointA])
  const errorsB = useMemo(() => axisErrors(pointB), [pointB])

  const distance = useMemo(
    () => (valueA && valueB ? haversineDistanceKm(valueA, valueB) : null),
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
        { id: 'distance-a', latitude: latitudeA, longitude: longitudeA, label: 'A' },
        { id: 'distance-b', latitude: latitudeB, longitude: longitudeB, label: 'B' },
      ],
      line: [
        { latitude: latitudeA, longitude: longitudeA },
        { latitude: latitudeB, longitude: longitudeB },
      ],
    })
  }, [latitudeA, longitudeA, latitudeB, longitudeB, setVisualization])

  const target = picking?.target
  const isPickingA = target === 'distance-a'
  const isPickingB = target === 'distance-b'

  const startPick = useCallback(
    (which: 'a' | 'b') => {
      startPicking({
        target: which === 'a' ? 'distance-a' : 'distance-b',
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

  const unitOption = getDistanceUnit(unit)
  const numericValue = distance === null ? null : convertDistance(distance, unit)
  const formattedDistance =
    numericValue === null
      ? ''
      : `${numericValue.toFixed(unitOption.precision)} ${unitOption.symbol}`

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
          idPrefix="distance-a"
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
          idPrefix="distance-b"
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

      <section className="tool-section" aria-label="Distance result">
        <div className="tool-section__head">
          <h3 className="tool-section__title">Distance</h3>
          {formattedDistance ? (
            <CopyButton text={formattedDistance} label="Copy distance" />
          ) : null}
        </div>

        {numericValue === null ? (
          <div className="empty-state">
            <p>
              Enter valid coordinates for both points, or pick them on the map,
              to calculate the distance.
            </p>
          </div>
        ) : (
          <div className="distance-result">
            <span className="distance-result__value">
              {numericValue.toFixed(unitOption.precision)}
            </span>
            <span className="distance-result__unit">{unitOption.symbol}</span>
          </div>
        )}

        <div className="control-row">
          <label className="control-row__label" htmlFor="distance-unit">
            Unit
          </label>
          <select
            id="distance-unit"
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

        <p className="tool-hint">
          Great-circle distance on a spherical Earth model (mean radius
          6371.0088 km), not an ellipsoidal geodesic.
        </p>
      </section>
    </>
  )
}
