import { describe, expect, it } from 'vitest'
import { haversineDistanceKm } from './distance'
import {
  assessZoneFit,
  geographicToUtm,
  normalizeLongitude,
  utmCentralMeridian,
  utmToGeographic,
  utmZoneFromLongitude,
  isValidUtmZone,
  isWithinUtmLatitude,
} from './utm'
import type { GeoPoint } from '../types/geo'

const CM_TOLERANCE_M = 0.001
const ROUND_TRIP_TOLERANCE_M = 0.01

function roundTripErrorMeters(point: GeoPoint, zone?: number): number {
  const forward = geographicToUtm(point, zone === undefined ? {} : { zone })
  const back = utmToGeographic(forward.utm)
  return haversineDistanceKm(point, back) * 1000
}

describe('UTM zone selection', () => {
  it('selects the standard zone from longitude', () => {
    expect(utmZoneFromLongitude(0)).toBe(31)
    expect(utmZoneFromLongitude(-180)).toBe(1)
    expect(utmZoneFromLongitude(180)).toBe(60)
    expect(utmZoneFromLongitude(-0.1278)).toBe(30)
  })

  it('treats a boundary longitude as the eastern zone', () => {
    expect(utmZoneFromLongitude(6)).toBe(32)
    expect(utmZoneFromLongitude(-6)).toBe(30)
  })

  it('applies the Norway 32V exception', () => {
    expect(utmZoneFromLongitude(5, 60)).toBe(32)
    expect(utmZoneFromLongitude(7, 58)).toBe(32)
    // Outside the exception band, the standard rule applies.
    expect(utmZoneFromLongitude(5, 50)).toBe(31)
  })

  it('applies the Svalbard exceptions', () => {
    expect(utmZoneFromLongitude(5, 78)).toBe(31)
    expect(utmZoneFromLongitude(15, 78)).toBe(33)
    expect(utmZoneFromLongitude(25, 78)).toBe(35)
    expect(utmZoneFromLongitude(37, 78)).toBe(37)
  })

  it('rejects invalid zones', () => {
    expect(isValidUtmZone(0)).toBe(false)
    expect(isValidUtmZone(61)).toBe(false)
    expect(isValidUtmZone(30.5)).toBe(false)
    expect(isValidUtmZone(30)).toBe(true)
  })

  it('reports coverage for the latitude band', () => {
    expect(isWithinUtmLatitude(84)).toBe(true)
    expect(isWithinUtmLatitude(-80)).toBe(true)
    expect(isWithinUtmLatitude(84.0001)).toBe(false)
    expect(isWithinUtmLatitude(-80.0001)).toBe(false)
  })

  it('computes central meridians', () => {
    expect(utmCentralMeridian(1)).toBe(-177)
    expect(utmCentralMeridian(31)).toBe(3)
    expect(utmCentralMeridian(60)).toBe(177)
    expect(() => utmCentralMeridian(0)).toThrow(RangeError)
  })

  it('normalizes longitude into -180..180', () => {
    expect(normalizeLongitude(190)).toBe(-170)
    expect(normalizeLongitude(-190)).toBe(170)
    expect(normalizeLongitude(180)).toBe(180)
  })
})

describe('UTM forward projection', () => {
  it('places the equator on the central meridian at false easting / zero northing', () => {
    for (let zone = 1; zone <= 60; zone++) {
      const lon = utmCentralMeridian(zone)
      const north = geographicToUtm({ latitude: 0, longitude: lon }, { zone })
      expect(north.utm.hemisphere).toBe('N')
      expect(Math.abs(north.utm.easting - 500000)).toBeLessThan(CM_TOLERANCE_M)
      expect(Math.abs(north.utm.northing)).toBeLessThan(CM_TOLERANCE_M)

      const south = geographicToUtm({ latitude: 0, longitude: lon }, { zone })
      expect(south.utm.hemisphere).toBe('N')
    }
  })

  it('applies the southern false northing at the equator', () => {
    const south = geographicToUtm({ latitude: -0.000001, longitude: 3 })
    expect(south.utm.hemisphere).toBe('S')
    expect(Math.abs(south.utm.northing - 10000000)).toBeLessThan(1)
  })

  it('matches a known London reference value (zone 30N)', () => {
    const result = geographicToUtm({ latitude: 51.5074, longitude: -0.1278 })
    expect(result.utm.zone).toBe(30)
    expect(result.utm.hemisphere).toBe('N')
    expect(result.utm.easting).toBeCloseTo(699316.2343, 2)
    expect(result.utm.northing).toBeCloseTo(5710163.7581, 2)
  })

  it('reports the automatic zone and honors a manual override', () => {
    const automatic = geographicToUtm({ latitude: 40.7128, longitude: -74.006 })
    expect(automatic.automaticZone).toBe(18)
    expect(automatic.manualZoneOverride).toBe(false)

    const manual = geographicToUtm(
      { latitude: 40.7128, longitude: -74.006 },
      { zone: 17 },
    )
    expect(manual.utm.zone).toBe(17)
    expect(manual.automaticZone).toBe(18)
    expect(manual.manualZoneOverride).toBe(true)
  })

  it('rejects latitudes outside UTM coverage', () => {
    expect(() => geographicToUtm({ latitude: 85, longitude: 0 })).toThrow(
      RangeError,
    )
    expect(() => geographicToUtm({ latitude: -81, longitude: 0 })).toThrow(
      RangeError,
    )
  })

  it('rejects non-finite coordinates and invalid zones', () => {
    expect(() =>
      geographicToUtm({ latitude: Number.NaN, longitude: 0 }),
    ).toThrow(RangeError)
    expect(() =>
      geographicToUtm({ latitude: 0, longitude: 0 }, { zone: 61 }),
    ).toThrow(RangeError)
  })
})

describe('UTM inverse projection', () => {
  it('reverses a UTM coordinate to geographic', () => {
    const point = utmToGeographic({
      zone: 56,
      hemisphere: 'S',
      easting: 334368.6336,
      northing: 6250948.3454,
    })
    expect(point.latitude).toBeCloseTo(-33.8688, 6)
    expect(point.longitude).toBeCloseTo(151.2093, 6)
  })

  it('rejects invalid easting and northing', () => {
    expect(() =>
      utmToGeographic({
        zone: 31,
        hemisphere: 'N',
        easting: -1,
        northing: 0,
      }),
    ).toThrow(RangeError)
    expect(() =>
      utmToGeographic({
        zone: 31,
        hemisphere: 'N',
        easting: 500000,
        northing: 20000000,
      }),
    ).toThrow(RangeError)
    expect(() =>
      utmToGeographic({
        zone: 31,
        hemisphere: 'N',
        easting: Number.POSITIVE_INFINITY,
        northing: 0,
      }),
    ).toThrow(RangeError)
  })

  it('rejects invalid zone and hemisphere', () => {
    expect(() =>
      utmToGeographic({
        zone: 0,
        hemisphere: 'N',
        easting: 500000,
        northing: 0,
      }),
    ).toThrow(RangeError)
    expect(() =>
      utmToGeographic({
        zone: 31,
        hemisphere: 'X' as 'N',
        easting: 500000,
        northing: 0,
      }),
    ).toThrow(RangeError)
  })
})

describe('UTM round-trip accuracy', () => {
  const points: readonly GeoPoint[] = [
    { latitude: 51.5074, longitude: -0.1278 },
    { latitude: 35.6762, longitude: 139.6503 },
    { latitude: -33.8688, longitude: 151.2093 },
    { latitude: 40.7128, longitude: -74.006 },
    { latitude: 64.1466, longitude: -21.9426 },
    { latitude: -54.8019, longitude: -68.303 },
    { latitude: 1.3521, longitude: 103.8198 },
    { latitude: 78.2232, longitude: 15.6469 },
  ]

  it('stays within 1 cm for representative points', () => {
    for (const point of points) {
      expect(roundTripErrorMeters(point)).toBeLessThan(ROUND_TRIP_TOLERANCE_M)
    }
  })

  it('stays within 1 cm for the same points in every neighboring zone override', () => {
    const center = { latitude: 48.8566, longitude: 2.3522 }
    const automatic = geographicToUtm(center)
    for (const zone of [automatic.utm.zone - 1, automatic.utm.zone, automatic.utm.zone + 1]) {
      if (!isValidUtmZone(zone)) {
        continue
      }
      expect(roundTripErrorMeters(center, zone)).toBeLessThan(
        ROUND_TRIP_TOLERANCE_M,
      )
    }
  })

  it('stays within 1 cm near zone boundaries', () => {
    const boundaryPoints: readonly GeoPoint[] = [
      { latitude: 45, longitude: 11.999999 },
      { latitude: 45, longitude: 12.000001 },
      { latitude: -10, longitude: -173.999999 },
      { latitude: -10, longitude: -174.000001 },
    ]
    for (const point of boundaryPoints) {
      expect(roundTripErrorMeters(point)).toBeLessThan(ROUND_TRIP_TOLERANCE_M)
    }
  })
})

describe('UTM zone fit warnings', () => {
  it('does not warn inside the nominal zone', () => {
    const fit = assessZoneFit(4, 31)
    expect(fit.outsideNominalZone).toBe(false)
    expect(fit.warning).toBeUndefined()
  })

  it('warns when the point is far from the selected zone', () => {
    const fit = assessZoneFit(20, 31)
    expect(fit.deviationDeg).toBeCloseTo(17, 5)
    expect(fit.outsideNominalZone).toBe(true)
    expect(fit.warning).toBeDefined()
  })
})
