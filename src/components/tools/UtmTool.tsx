import { useCallback, useMemo, useState } from 'react'
import type { GeoPoint } from '../../types/geo'
import CoordinatePair from '../ui/CoordinatePair'
import type { CoordinateInput } from '../ui/CoordinatePair'
import CopyButton from '../ui/CopyButton'
import { useMapWorkspace } from '../../map/workspace'
import {
  DEFAULT_SECONDS_PRECISION,
  decimalToDms,
  formatDecimalDegrees,
  formatDms,
} from '../../core/coordinates'
import {
  UTM_MAX_LATITUDE,
  UTM_MIN_LATITUDE,
  geographicToUtm,
  isWithinUtmLatitude,
  isValidUtmZone,
  utmToGeographic,
  utmZoneFromLongitude,
} from '../../core/utm'
import type { UtmHemisphere } from '../../core/utm'
import {
  EMPTY_COORDINATE_INPUT,
  decimalAxisError,
  parseDecimalCoordinate,
} from './coordinateInput'

type UtmMode = 'geographic-to-utm' | 'utm-to-geographic'

const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/
const INTEGER_PATTERN = /^[+-]?\d+$/

function parseNumber(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '' || !NUMBER_PATTERN.test(trimmed)) {
    return null
  }
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

function parseInteger(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '' || !INTEGER_PATTERN.test(trimmed)) {
    return null
  }
  const value = Number(trimmed)
  return Number.isInteger(value) ? value : null
}

function dmsString(value: number, axis: 'latitude' | 'longitude'): string {
  const converted = decimalToDms(value, axis, DEFAULT_SECONDS_PRECISION)
  return converted.ok ? formatDms(converted.value, DEFAULT_SECONDS_PRECISION) : ''
}

interface NumberFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  inputMode?: 'decimal' | 'numeric'
}

function NumberField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  inputMode = 'decimal',
}: NumberFieldProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field__input"
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
      {hint ? <p className="tool-hint">{hint}</p> : null}
    </div>
  )
}

export default function UtmTool() {
  const { setVisualization, focusOn } = useMapWorkspace()

  const [mode, setMode] = useState<UtmMode>('geographic-to-utm')
  const [coordinate, setCoordinate] = useState<CoordinateInput>(
    EMPTY_COORDINATE_INPUT,
  )
  const [zoneText, setZoneText] = useState('')
  const [manualZone, setManualZone] = useState(false)
  const [hemisphere, setHemisphere] = useState<UtmHemisphere>('N')
  const [eastingText, setEastingText] = useState('')
  const [northingText, setNorthingText] = useState('')

  const latitudeError = decimalAxisError(coordinate.latitude, 'latitude')
  const longitudeError = decimalAxisError(coordinate.longitude, 'longitude')
  const decimalPoint = useMemo(
    () => parseDecimalCoordinate(coordinate),
    [coordinate],
  )
  const coverageError =
    decimalPoint && !isWithinUtmLatitude(decimalPoint.latitude)
      ? `Latitude must be between ${UTM_MIN_LATITUDE} and ${UTM_MAX_LATITUDE} degrees for UTM conversion.`
      : undefined

  const automaticZone =
    decimalPoint !== null
      ? utmZoneFromLongitude(decimalPoint.longitude, decimalPoint.latitude)
      : null

  const manualZoneValue = parseInteger(zoneText)
  const zoneError =
    manualZone &&
    (manualZoneValue === null || !isValidUtmZone(manualZoneValue))
      ? 'Zone must be an integer between 1 and 60.'
      : undefined

  const displayedZone = manualZone
    ? zoneText
    : automaticZone !== null
      ? String(automaticZone)
      : ''

  const forwardResult = useMemo(() => {
    if (
      decimalPoint === null ||
      coverageError !== undefined ||
      zoneError !== undefined
    ) {
      return null
    }
    try {
      return geographicToUtm(
        decimalPoint,
        manualZone && manualZoneValue !== null
          ? { zone: manualZoneValue }
          : {},
      )
    } catch {
      return null
    }
  }, [decimalPoint, coverageError, zoneError, manualZone, manualZoneValue])

  const eastingValue = parseNumber(eastingText)
  const northingValue = parseNumber(northingText)
  const zoneInputValue = parseInteger(zoneText)

  const zoneInputError =
    zoneText.trim() !== '' &&
    (zoneInputValue === null || !isValidUtmZone(zoneInputValue))
      ? 'Zone must be an integer between 1 and 60.'
      : undefined
  const eastingError =
    eastingText.trim() !== '' &&
    (eastingValue === null || eastingValue < 0 || eastingValue > 1000000)
      ? 'Easting must be between 0 and 1000000 metres.'
      : undefined
  const northingError =
    northingText.trim() !== '' &&
    (northingValue === null || northingValue < 0 || northingValue > 10000000)
      ? 'Northing must be between 0 and 10000000 metres.'
      : undefined

  const inverseResult = useMemo(() => {
    if (
      zoneInputValue === null ||
      !isValidUtmZone(zoneInputValue) ||
      eastingValue === null ||
      northingValue === null ||
      eastingError !== undefined ||
      northingError !== undefined
    ) {
      return null
    }
    try {
      return utmToGeographic({
        zone: zoneInputValue,
        hemisphere,
        easting: eastingValue,
        northing: northingValue,
      })
    } catch {
      return null
    }
  }, [
    zoneInputValue,
    eastingValue,
    northingValue,
    hemisphere,
    eastingError,
    northingError,
  ])

  const showPoint = useCallback(
    (point: GeoPoint) => {
      setVisualization({
        points: [{ id: 'utm-point', ...point }],
      })
      focusOn(point)
    },
    [setVisualization, focusOn],
  )

  const forwardCopyText = forwardResult
    ? `${forwardResult.utm.zone}${forwardResult.utm.hemisphere} E ${forwardResult.utm.easting.toFixed(3)} N ${forwardResult.utm.northing.toFixed(3)}`
    : ''
  const inverseCopyText = inverseResult
    ? `${formatDecimalDegrees(inverseResult.latitude)}, ${formatDecimalDegrees(inverseResult.longitude)}`
    : ''

  const manualOverrideInfo =
    forwardResult &&
    forwardResult.manualZoneOverride &&
    automaticZone !== null &&
    forwardResult.utm.zone !== automaticZone
      ? `Manual override: automatic zone would be ${automaticZone}.`
      : undefined

  return (
    <>
      <div className="segmented" role="group" aria-label="Conversion direction">
        <button
          type="button"
          className="segmented__button"
          aria-pressed={mode === 'geographic-to-utm'}
          onClick={() => setMode('geographic-to-utm')}
        >
          Geographic → UTM
        </button>
        <button
          type="button"
          className="segmented__button"
          aria-pressed={mode === 'utm-to-geographic'}
          onClick={() => setMode('utm-to-geographic')}
        >
          UTM → Geographic
        </button>
      </div>

      {mode === 'geographic-to-utm' ? (
        <>
          <section className="tool-section" aria-label="Geographic coordinates">
            <h3 className="tool-section__title">Geographic (WGS84)</h3>
            <CoordinatePair
              idPrefix="utm-geographic"
              legend="Latitude and longitude in decimal degrees"
              value={coordinate}
              errors={{ latitude: latitudeError, longitude: longitudeError }}
              onChange={setCoordinate}
            />
            {coverageError ? (
              <p className="notice notice--error" role="status">
                {coverageError}
              </p>
            ) : null}
          </section>

          <section className="tool-section" aria-label="Zone">
            <div className="tool-section__head">
              <h3 className="tool-section__title">Zone</h3>
              {manualZone ? (
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => {
                    setManualZone(false)
                    setZoneText('')
                  }}
                >
                  Use automatic
                </button>
              ) : (
                <span className="chip chip--accent">
                  Automatic{automaticZone !== null ? `: ${automaticZone}` : ''}
                </span>
              )}
            </div>
            <NumberField
              id="utm-zone"
              label="Zone (1–60)"
              value={displayedZone}
              inputMode="numeric"
              onChange={(value) => {
                setManualZone(true)
                setZoneText(value)
              }}
              error={zoneError}
              hint={
                !manualZone
                  ? 'Selected automatically from longitude. Type to override.'
                  : undefined
              }
            />
            {manualOverrideInfo ? (
              <p className="tool-hint">{manualOverrideInfo}</p>
            ) : null}
            {forwardResult?.zoneFit.warning ? (
              <p className="notice notice--warning" role="status">
                {forwardResult.zoneFit.warning}
              </p>
            ) : null}
          </section>

          <section className="tool-section" aria-label="UTM result">
            <div className="tool-section__head">
              <h3 className="tool-section__title">UTM result</h3>
              {forwardResult ? (
                <CopyButton text={forwardCopyText} label="Copy UTM" />
              ) : null}
            </div>
            {forwardResult ? (
              <>
                <dl className="result-list">
                  <div className="result-list__row">
                    <dt className="result-list__label">Zone &amp; hemisphere</dt>
                    <dd className="result-list__value">
                      {forwardResult.utm.zone}
                      {forwardResult.utm.hemisphere}
                    </dd>
                  </div>
                  <div className="result-list__row">
                    <dt className="result-list__label">Easting</dt>
                    <dd className="result-list__value">
                      {forwardResult.utm.easting.toFixed(3)} m
                    </dd>
                  </div>
                  <div className="result-list__row">
                    <dt className="result-list__label">Northing</dt>
                    <dd className="result-list__value">
                      {forwardResult.utm.northing.toFixed(3)} m
                    </dd>
                  </div>
                </dl>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--primary button--small"
                    onClick={() => {
                      if (decimalPoint !== null) {
                        showPoint(decimalPoint)
                      }
                    }}
                  >
                    Show on map
                  </button>
                </div>
                <p className="tool-hint">
                  UTM uses the WGS84 ellipsoid via proj4. The Distance, Bearing
                  and area tools use a spherical model, so results differ
                  slightly.
                </p>
              </>
            ) : (
              <div className="empty-state">
                <p>
                  Enter a latitude and longitude to convert to UTM. Inputs must
                  fall within the UTM latitude band of {UTM_MIN_LATITUDE}° to{' '}
                  {UTM_MAX_LATITUDE}°.
                </p>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="tool-section" aria-label="UTM coordinate">
            <h3 className="tool-section__title">UTM coordinate</h3>
            <div className="field-grid">
              <NumberField
                id="utm-in-zone"
                label="Zone (1–60)"
                value={zoneText}
                inputMode="numeric"
                onChange={setZoneText}
                error={zoneInputError}
              />
              <div className="field">
                <label className="field__label" htmlFor="utm-in-hemisphere">
                  Hemisphere
                </label>
                <select
                  id="utm-in-hemisphere"
                  className="select"
                  value={hemisphere}
                  onChange={(event) => {
                    const next = event.target.value
                    if (next === 'N' || next === 'S') {
                      setHemisphere(next)
                    }
                  }}
                >
                  <option value="N">North (N)</option>
                  <option value="S">South (S)</option>
                </select>
              </div>
            </div>
            <div className="field-grid">
              <NumberField
                id="utm-in-easting"
                label="Easting (m)"
                value={eastingText}
                onChange={setEastingText}
                error={eastingError}
              />
              <NumberField
                id="utm-in-northing"
                label="Northing (m)"
                value={northingText}
                onChange={setNorthingText}
                error={northingError}
              />
            </div>
          </section>

          <section className="tool-section" aria-label="Geographic result">
            <div className="tool-section__head">
              <h3 className="tool-section__title">Geographic result</h3>
              {inverseResult ? (
                <CopyButton text={inverseCopyText} label="Copy decimal" />
              ) : null}
            </div>
            {inverseResult ? (
              <>
                <div className="result-block">
                  <div>
                    <span className="result-block__label">Decimal degrees</span>
                    <p className="result-block__value">{inverseCopyText}</p>
                  </div>
                  <div>
                    <span className="result-block__label">DMS</span>
                    <p className="result-block__value">
                      {dmsString(inverseResult.latitude, 'latitude')},{' '}
                      {dmsString(inverseResult.longitude, 'longitude')}
                    </p>
                  </div>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--primary button--small"
                    onClick={() => showPoint(inverseResult)}
                  >
                    Show on map
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>
                  Enter a zone, hemisphere, easting and northing to convert back
                  to latitude and longitude.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
