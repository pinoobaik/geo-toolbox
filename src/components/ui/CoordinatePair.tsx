import type { ChangeEvent } from 'react'

export interface CoordinateInput {
  latitude: string
  longitude: string
}

export interface CoordinateErrors {
  latitude?: string
  longitude?: string
}

interface CoordinatePairProps {
  idPrefix: string
  legend: string
  value: CoordinateInput
  errors: CoordinateErrors
  onChange: (value: CoordinateInput) => void
  disabled?: boolean
}

export default function CoordinatePair({
  idPrefix,
  legend,
  value,
  errors,
  onChange,
  disabled = false,
}: CoordinatePairProps) {
  const latitudeId = `${idPrefix}-latitude`
  const longitudeId = `${idPrefix}-longitude`
  const latitudeErrorId = `${latitudeId}-error`
  const longitudeErrorId = `${longitudeId}-error`

  const handleChange =
    (axis: 'latitude' | 'longitude') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, [axis]: event.target.value })
    }

  return (
    <fieldset className="field-group" disabled={disabled}>
      <legend className="field-group__legend">{legend}</legend>
      <div className="field-grid">
        <div className="field">
          <label className="field__label" htmlFor={latitudeId}>
            Latitude
          </label>
          <input
            id={latitudeId}
            className="field__input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={value.latitude}
            onChange={handleChange('latitude')}
            aria-invalid={errors.latitude ? true : undefined}
            aria-describedby={errors.latitude ? latitudeErrorId : undefined}
          />
          {errors.latitude ? (
            <p className="field__error" id={latitudeErrorId}>
              {errors.latitude}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label className="field__label" htmlFor={longitudeId}>
            Longitude
          </label>
          <input
            id={longitudeId}
            className="field__input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={value.longitude}
            onChange={handleChange('longitude')}
            aria-invalid={errors.longitude ? true : undefined}
            aria-describedby={errors.longitude ? longitudeErrorId : undefined}
          />
          {errors.longitude ? (
            <p className="field__error" id={longitudeErrorId}>
              {errors.longitude}
            </p>
          ) : null}
        </div>
      </div>
    </fieldset>
  )
}
