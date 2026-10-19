import { useCallback, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { LatLngBoundsExpression } from 'leaflet'
import { useMapWorkspace } from '../../map/workspace'
import {
  MAX_GEOJSON_BYTES,
  buildGeoJsonExport,
  checkByteSize,
  formatPropertyValue,
  parseGeoJsonText,
  suggestedExportFilename,
} from '../../core/geojson'
import type {
  GeoJsonBounds,
  GeoJsonExportMode,
  GeoJsonSourceKind,
  GeoJsonValidationError,
} from '../../core/geojson'

const SOURCE_KIND_LABELS: Record<GeoJsonSourceKind, string> = {
  geometry: 'Standalone geometry',
  feature: 'Single feature',
  featureCollection: 'Feature collection',
}

function boundsToLeaflet(bounds: GeoJsonBounds): LatLngBoundsExpression {
  return [
    [bounds.minLatitude, bounds.minLongitude],
    [bounds.maxLatitude, bounds.maxLongitude],
  ]
}

function formatBounds(bounds: GeoJsonBounds): string {
  const south = bounds.minLatitude.toFixed(5)
  const west = bounds.minLongitude.toFixed(5)
  const north = bounds.maxLatitude.toFixed(5)
  const east = bounds.maxLongitude.toFixed(5)
  return `${south}, ${west} → ${north}, ${east}`
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function GeoJsonTool() {
  const {
    map,
    geoJson,
    setGeoJson,
    selectedGeoJsonEntry,
    setSelectedGeoJsonEntry,
  } = useMapWorkspace()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<GeoJsonValidationError | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [exportMode, setExportMode] = useState<GeoJsonExportMode>('source')

  const importFile = useCallback(
    async (file: File) => {
      setError(null)
      const sizeError = checkByteSize(file.size)
      if (sizeError) {
        setError(sizeError)
        return
      }

      setIsImporting(true)
      try {
        const text = await file.text()
        const result = parseGeoJsonText(text)
        if (!result.ok) {
          setError(result.error)
          return
        }
        setGeoJson(result.dataset)
        setSelectedGeoJsonEntry(null)
        setFileName(file.name)
      } catch {
        setError({
          code: 'json',
          message: 'The file could not be read. It may be corrupted or inaccessible.',
        })
      } finally {
        setIsImporting(false)
      }
    },
    [setGeoJson, setSelectedGeoJsonEntry],
  )

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget
      const file = input.files && input.files.length > 0 ? input.files[0] : null
      input.value = ''
      if (!file || isImporting) {
        return
      }
      void importFile(file)
    },
    [importFile, isImporting],
  )

  const handleChooseFile = useCallback(() => {
    if (isImporting) {
      return
    }
    fileInputRef.current?.click()
  }, [isImporting])

  const fitBounds = useCallback(
    (bounds: LatLngBoundsExpression) => {
      if (map) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
      }
    },
    [map],
  )

  const handleZoomToData = useCallback(() => {
    if (geoJson && geoJson.bounds) {
      fitBounds(boundsToLeaflet(geoJson.bounds))
    }
  }, [geoJson, fitBounds])

  const handleSelectEntry = useCallback(
    (index: number) => {
      if (selectedGeoJsonEntry === index) {
        setSelectedGeoJsonEntry(null)
        return
      }
      setSelectedGeoJsonEntry(index)
      const entry = geoJson?.entries.find((candidate) => candidate.index === index)
      if (entry && entry.bounds) {
        fitBounds(boundsToLeaflet(entry.bounds))
      }
    },
    [geoJson, selectedGeoJsonEntry, setSelectedGeoJsonEntry, fitBounds],
  )

  const handleClear = useCallback(() => {
    setGeoJson(null)
    setSelectedGeoJsonEntry(null)
    setFileName(null)
    setError(null)
  }, [setGeoJson, setSelectedGeoJsonEntry])

  const handleExport = useCallback(() => {
    if (!geoJson) {
      return
    }
    const text = buildGeoJsonExport(geoJson, exportMode)
    downloadText(suggestedExportFilename(fileName), text)
  }, [geoJson, exportMode, fileName])

  const selectedEntry = useMemo(() => {
    if (!geoJson || selectedGeoJsonEntry === null) {
      return null
    }
    return (
      geoJson.entries.find((entry) => entry.index === selectedGeoJsonEntry) ??
      null
    )
  }, [geoJson, selectedGeoJsonEntry])

  const propertyEntries = selectedEntry?.properties
    ? Object.entries(selectedEntry.properties)
    : []

  const hasData = geoJson !== null

  return (
    <>
      <section className="tool-section" aria-label="Import GeoJSON">
        <h3 className="tool-section__title">Import</h3>
        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={handleChooseFile}
            disabled={isImporting}
          >
            {isImporting ? 'Reading file…' : 'Choose file'}
          </button>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={handleClear}
            disabled={!hasData || isImporting}
          >
            Clear dataset
          </button>
        </div>
        <input
          ref={fileInputRef}
          id="geojson-file-input"
          className="visually-hidden"
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          onChange={handleFileChange}
          disabled={isImporting}
          tabIndex={-1}
        />
        <p className="tool-hint">
          Accepts GeoJSON (.geojson, .json) up to 10 MB. Coordinates are read as
          WGS84 longitude/latitude.
        </p>
        <p className="visually-hidden" role="status" aria-live="polite">
          {isImporting ? 'Reading file' : ''}
        </p>
        {error ? (
          <p className="notice notice--error" role="alert">
            {error.message}
          </p>
        ) : null}
      </section>

      {hasData && geoJson ? (
        <>
          <section className="tool-section" aria-label="Imported dataset">
            <div className="tool-section__head">
              <h3 className="tool-section__title">Dataset</h3>
              <span className="chip">
                {SOURCE_KIND_LABELS[geoJson.sourceKind]}
              </span>
            </div>
            {fileName ? (
              <p className="dataset-name" title={fileName}>
                <span className="visually-hidden">Imported file: </span>
                {fileName}
              </p>
            ) : null}
            <dl className="result-list">
              {geoJson.featureCount > 0 ? (
                <div className="result-list__row">
                  <dt className="result-list__label">Features</dt>
                  <dd className="result-list__value">{geoJson.featureCount}</dd>
                </div>
              ) : null}
              <div className="result-list__row">
                <dt className="result-list__label">Geometries</dt>
                <dd className="result-list__value">{geoJson.geometryCount}</dd>
              </div>
              <div className="result-list__row">
                <dt className="result-list__label">Bounds</dt>
                <dd className="result-list__value">
                  {geoJson.bounds ? (
                    <span className="mono">{formatBounds(geoJson.bounds)}</span>
                  ) : (
                    'No coordinates'
                  )}
                </dd>
              </div>
            </dl>
            <div className="button-row">
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={handleZoomToData}
                disabled={!geoJson.bounds}
              >
                Zoom to data
              </button>
            </div>
          </section>

          <section className="tool-section" aria-label="Features">
            <div className="tool-section__head">
              <h3 className="tool-section__title">Features</h3>
              <span className="chip">{geoJson.entries.length}</span>
            </div>
            {geoJson.entries.length === 0 ? (
              <div className="empty-state">
                <p>This collection contains no features.</p>
              </div>
            ) : (
              <ul className="feature-list">
                {geoJson.entries.map((entry) => {
                  const selected = entry.index === selectedGeoJsonEntry
                  return (
                    <li key={entry.index}>
                      <button
                        type="button"
                        className="feature-list__button"
                        aria-pressed={selected}
                        onClick={() => handleSelectEntry(entry.index)}
                        disabled={!entry.bounds}
                        title={
                          entry.bounds
                            ? `Select and zoom to ${entry.label}`
                            : `${entry.label} has no coordinates`
                        }
                      >
                        <span className="feature-list__index">
                          {entry.index + 1}
                        </span>
                        <span className="feature-list__body">
                          <span className="feature-list__label">
                            {entry.label}
                          </span>
                          <span className="feature-list__meta">
                            {entry.geometryType}
                            {entry.id !== undefined ? ` · id ${entry.id}` : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {selectedEntry ? (
            <section className="tool-section" aria-label="Selected feature">
              <div className="tool-section__head">
                <h3 className="tool-section__title">Selected feature</h3>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => setSelectedGeoJsonEntry(null)}
                >
                  Deselect
                </button>
              </div>
              <dl className="result-list">
                <div className="result-list__row">
                  <dt className="result-list__label">Label</dt>
                  <dd className="result-list__value">{selectedEntry.label}</dd>
                </div>
                <div className="result-list__row">
                  <dt className="result-list__label">Geometry</dt>
                  <dd className="result-list__value">
                    {selectedEntry.geometryType}
                  </dd>
                </div>
                {selectedEntry.id !== undefined ? (
                  <div className="result-list__row">
                    <dt className="result-list__label">Feature id</dt>
                    <dd className="result-list__value">{selectedEntry.id}</dd>
                  </div>
                ) : null}
              </dl>
              <h4 className="tool-section__subtitle">Properties</h4>
              {propertyEntries.length === 0 ? (
                <div className="empty-state">
                  <p>No properties on this feature.</p>
                </div>
              ) : (
                <dl className="property-list">
                  {propertyEntries.map(([key, value]) => (
                    <div className="property-list__row" key={key}>
                      <dt className="property-list__key">{key}</dt>
                      <dd className="property-list__value">
                        {formatPropertyValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ) : null}

          <section className="tool-section" aria-label="Export GeoJSON">
            <h3 className="tool-section__title">Export</h3>
            <div className="segmented" role="group" aria-label="Export format">
              <button
                type="button"
                className="segmented__button"
                aria-pressed={exportMode === 'source'}
                onClick={() => setExportMode('source')}
              >
                Source structure
              </button>
              <button
                type="button"
                className="segmented__button"
                aria-pressed={exportMode === 'feature-collection'}
                onClick={() => setExportMode('feature-collection')}
              >
                Normalized FeatureCollection
              </button>
            </div>
            <p className="tool-hint">
              {exportMode === 'source'
                ? 'Exports the imported structure exactly (a geometry stays a geometry, a single Feature stays a Feature).'
                : 'Exports everything as a FeatureCollection; a standalone geometry becomes a Feature with no properties.'}
            </p>
            <div className="button-row">
              <button
                type="button"
                className="button button--primary button--small"
                onClick={handleExport}
                disabled={!hasData}
              >
                Download GeoJSON
              </button>
            </div>
          </section>
        </>
      ) : (
        <div className="empty-state">
          <p>
            Choose a GeoJSON file to display it on the map, inspect its features
            and export it again. Measurement and drawing tools keep working
            independently.
          </p>
        </div>
      )}

      <p className="tool-hint">
        Maximum supported file size: {Math.round(MAX_GEOJSON_BYTES / (1024 * 1024))} MB.
        Imported data is processed locally in your browser and never uploaded.
      </p>
    </>
  )
}
