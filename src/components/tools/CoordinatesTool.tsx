import { useCallback, useMemo, useState } from 'react'
import type { GeoPoint } from '../../types/geo'
import type { CoordinateAxis } from '../../core/coordinates'
import {
  DEFAULT_DECIMAL_PRECISION,
  DEFAULT_SECONDS_PRECISION,
  decimalToDms,
  formatDecimalDegrees,
  formatDms,
} from '../../core/coordinates'
import CoordinatePair from '../ui/CoordinatePair'
import type { CoordinateErrors, CoordinateInput } from '../ui/CoordinatePair'
import CopyButton from '../ui/CopyButton'
import { useMapWorkspace } from '../../map/workspace'
import {
  EMPTY_COORDINATE_INPUT,
  decimalAxisError,
  dmsAxisError,
  formatCoordinateInput,
  parseDecimalCoordinate,
  parseDmsCoordinate,
} from './coordinateInput'

type Editing = 'decimal' | 'dms'

const PRECISION_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const

function dmsComponentString(value: number, axis: CoordinateAxis): string {
  const converted = decimalToDms(value, axis, DEFAULT_SECONDS_PRECISION)
  return converted.ok ? formatDms(converted.value, DEFAULT_SECONDS_PRECISION) : ''
}

function dmsToString(point: GeoPoint): CoordinateInput {
  return {
    latitude: dmsComponentString(point.latitude, 'latitude'),
    longitude: dmsComponentString(point.longitude, 'longitude'),
  }
}

export default function CoordinatesTool() {
  const { setVisualization, focusOn, startPicking, cancelPicking, picking } =
    useMapWorkspace()

  const [editing, setEditing] = useState<Editing>('decimal')
  const [decimalInput, setDecimalInput] = useState<CoordinateInput>(
    EMPTY_COORDINATE_INPUT,
  )
  const [dmsInput, setDmsInput] = useState<CoordinateInput>(
    EMPTY_COORDINATE_INPUT,
  )
  const [precision, setPrecision] = useState<number>(DEFAULT_DECIMAL_PRECISION)

  const decimalCoordinate = useMemo(
    () => parseDecimalCoordinate(decimalInput),
    [decimalInput],
  )
  const dmsCoordinate = useMemo(
    () => parseDmsCoordinate(dmsInput),
    [dmsInput],
  )

  const decimalErrors = useMemo<CoordinateErrors>(() => {
    if (editing !== 'decimal') {
      return {}
    }
    return {
      latitude: decimalAxisError(decimalInput.latitude, 'latitude'),
      longitude: decimalAxisError(decimalInput.longitude, 'longitude'),
    }
  }, [editing, decimalInput])

  const dmsErrors = useMemo<CoordinateErrors>(() => {
    if (editing !== 'dms') {
      return {}
    }
    return {
      latitude: dmsAxisError(dmsInput.latitude, 'latitude'),
      longitude: dmsAxisError(dmsInput.longitude, 'longitude'),
    }
  }, [editing, dmsInput])

  const displayedDecimal = useMemo<CoordinateInput>(() => {
    if (editing === 'decimal') {
      return decimalInput
    }
    return dmsCoordinate ? formatCoordinateInput(dmsCoordinate, precision) : EMPTY_COORDINATE_INPUT
  }, [editing, decimalInput, dmsCoordinate, precision])

  const displayedDms = useMemo<CoordinateInput>(() => {
    if (editing === 'dms') {
      return dmsInput
    }
    return decimalCoordinate ? dmsToString(decimalCoordinate) : EMPTY_COORDINATE_INPUT
  }, [editing, dmsInput, decimalCoordinate])

  const sourceCoordinate =
    editing === 'decimal' ? decimalCoordinate : dmsCoordinate

  const decimalText = sourceCoordinate
    ? `${formatDecimalDegrees(sourceCoordinate.latitude, precision)}, ${formatDecimalDegrees(sourceCoordinate.longitude, precision)}`
    : ''
  const dmsText = sourceCoordinate
    ? `${dmsComponentString(sourceCoordinate.latitude, 'latitude')}, ${dmsComponentString(sourceCoordinate.longitude, 'longitude')}`
    : ''

  const isPicking = picking?.target === 'coordinates'

  const handlePick = useCallback((point: GeoPoint) => {
    setDecimalInput(formatCoordinateInput(point, DEFAULT_DECIMAL_PRECISION))
    setEditing('decimal')
  }, [])

  const handleStartPick = () => {
    startPicking({
      target: 'coordinates',
      label: 'a coordinate',
      onPick: handlePick,
    })
  }

  const handleShowOnMap = () => {
    if (!sourceCoordinate) {
      return
    }
    setVisualization({
      points: [{ id: 'coordinate', ...sourceCoordinate }],
    })
    focusOn(sourceCoordinate)
  }

  const handleDecimalChange = (next: CoordinateInput) => {
    setEditing('decimal')
    setDecimalInput(next)
  }

  const handleDmsChange = (next: CoordinateInput) => {
    setEditing('dms')
    setDmsInput(next)
  }

  return (
    <>
      {isPicking ? (
        <div className="notice notice--pick" role="status">
          <span>Click the map to set the coordinate.</span>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={cancelPicking}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="button-row">
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={handleStartPick}
          >
            Pick on map
          </button>
        </div>
      )}

      <section className="tool-section" aria-label="Decimal degrees">
        <div className="tool-section__head">
          <h3 className="tool-section__title">Decimal degrees</h3>
          <div className="precision">
            <label
              className="precision__label"
              htmlFor="coordinates-precision"
            >
              Precision
            </label>
            <select
              id="coordinates-precision"
              className="select"
              value={precision}
              onChange={(event) => setPrecision(Number(event.target.value))}
            >
              {PRECISION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
        <CoordinatePair
          idPrefix="coordinates-decimal"
          legend="Latitude and longitude"
          value={displayedDecimal}
          errors={decimalErrors}
          onChange={handleDecimalChange}
        />
      </section>

      <section className="tool-section" aria-label="Degrees minutes seconds">
        <h3 className="tool-section__title">Degrees, minutes, seconds</h3>
        <CoordinatePair
          idPrefix="coordinates-dms"
          legend="Latitude and longitude"
          value={displayedDms}
          errors={dmsErrors}
          onChange={handleDmsChange}
        />
        <p className="tool-hint">
          Example: <span className="mono">7°47&apos;44.16&quot; S</span>
        </p>
      </section>

      <section className="tool-section" aria-label="Coordinate result">
        <h3 className="tool-section__title">Result</h3>
        <div className="result-block">
          <div>
            <span className="result-block__label">Decimal degrees</span>
            <p className="result-block__value">{decimalText || '—'}</p>
          </div>
          <div>
            <span className="result-block__label">DMS</span>
            <p className="result-block__value">{dmsText || '—'}</p>
          </div>
          <div className="result-block__footer">
            <CopyButton
              text={decimalText}
              label="Copy decimal"
              disabled={!sourceCoordinate}
            />
            <CopyButton
              text={dmsText}
              label="Copy DMS"
              disabled={!sourceCoordinate}
            />
            <button
              type="button"
              className="button button--primary button--small"
              onClick={handleShowOnMap}
              disabled={!sourceCoordinate}
            >
              Show on map
            </button>
          </div>
        </div>
      </section>

      {!sourceCoordinate ? (
        <p className="tool-hint">
          Enter a decimal degree or DMS coordinate to see the converted result.
        </p>
      ) : null}
    </>
  )
}
