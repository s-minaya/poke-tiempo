import { describe, expect, it } from 'vitest'

import type { ComplementAttempt } from './combine-weather.ts'
import { COMPLEMENT_METRICS_BY_PRIMARY_SOURCE, combineWeatherBlock, deriveSnowPresent } from './combine-weather.ts'
import type { WeatherBlock } from './types.ts'

const primary: WeatherBlock = {
  date: '2026-09-08',
  temperature: { maxC: 30, minC: 18 },
  sky: 'despejado',
  precipitation: { mm: null, probabilityPercent: 10 },
  snow: { cm: null, present: false },
  wind: { speedKmh: null, gustKmh: null },
  storm: false,
  calima: null,
  fog: false,
  primarySourceDescription: 'Despejado',
}

describe('deriveSnowPresent', () => {
  it.each([
    { cm: 0, categoricalPresent: true, expected: false, label: 'cm=0 manda aunque la categoría diga que sí' },
    { cm: 2.5, categoricalPresent: false, expected: true, label: 'cm>0 manda aunque la categoría diga que no' },
    { cm: null, categoricalPresent: true, expected: true, label: 'sin cm, cae a la categoría (true)' },
    { cm: null, categoricalPresent: false, expected: false, label: 'sin cm, cae a la categoría (false)' },
    { cm: null, categoricalPresent: null, expected: null, label: 'sin cm y sin categoría, sigue null' },
  ])('$label', ({ cm, categoricalPresent, expected }) => {
    expect(deriveSnowPresent(cm, categoricalPresent)).toBe(expected)
  })
})

describe('COMPLEMENT_METRICS_BY_PRIMARY_SOURCE', () => {
  it('España (AEMET) complementa precipitation.mm y snow.cm', () => {
    expect(COMPLEMENT_METRICS_BY_PRIMARY_SOURCE.aemet).toEqual(['precipitation.mm', 'snow.cm'])
  })

  it('Portugal (IPMA) complementa precipitation.mm, snow.cm, wind.speedKmh y wind.gustKmh', () => {
    expect(COMPLEMENT_METRICS_BY_PRIMARY_SOURCE.ipma).toEqual([
      'precipitation.mm',
      'snow.cm',
      'wind.speedKmh',
      'wind.gustKmh',
    ])
  })
})

describe('combineWeatherBlock', () => {
  it('fuente única sin complemento: bloque intacto, provenance sin complementary, sin degradaciones', () => {
    const attempt: ComplementAttempt = { status: 'ok', values: {} }
    const result = combineWeatherBlock(primary, 'open-meteo', 'open-meteo', [], attempt)

    expect(result.block).toEqual(primary)
    expect(result.provenance).toEqual({ primary: 'open-meteo' })
    expect(result.degradations).toEqual([])
  })

  it('complemento exitoso: aplica el valor y lo anota en provenance.complementary', () => {
    const attempt: ComplementAttempt = { status: 'ok', values: { 'precipitation.mm': 4.2 } }
    const result = combineWeatherBlock(primary, 'aemet', 'open-meteo', ['precipitation.mm'], attempt)

    expect(result.block.precipitation).toEqual({ mm: 4.2, probabilityPercent: 10 })
    expect(result.provenance).toEqual({
      primary: 'aemet',
      complementary: { 'precipitation.mm': 'open-meteo' },
    })
    expect(result.degradations).toEqual([])
  })

  it('complemento fallido aislado: degrada las métricas intentadas, el lugar sigue siendo válido', () => {
    const attempt: ComplementAttempt = { status: 'error' }
    const result = combineWeatherBlock(primary, 'aemet', 'open-meteo', ['precipitation.mm', 'snow.cm'], attempt)

    expect(result.block.precipitation).toEqual({ mm: null, probabilityPercent: 10 })
    expect(result.block.snow).toEqual({ cm: null, present: false })
    expect(result.provenance).toEqual({ primary: 'aemet' })
    expect(result.degradations).toEqual([
      { metric: 'precipitation.mm', reason: 'source_error', attemptedSource: 'open-meteo' },
      { metric: 'snow.cm', reason: 'source_error', attemptedSource: 'open-meteo' },
    ])
  })

  it('éxito parcial: status ok pero sin una métrica concreta en la respuesta degrada solo esa métrica', () => {
    const attempt: ComplementAttempt = { status: 'ok', values: { 'precipitation.mm': 3 } }
    const result = combineWeatherBlock(primary, 'aemet', 'open-meteo', ['precipitation.mm', 'snow.cm'], attempt)

    expect(result.block.precipitation?.mm).toBe(3)
    expect(result.block.snow).toEqual({ cm: null, present: false })
    expect(result.provenance).toEqual({
      primary: 'aemet',
      complementary: { 'precipitation.mm': 'open-meteo' },
    })
    expect(result.degradations).toEqual([
      { metric: 'snow.cm', reason: 'source_error', attemptedSource: 'open-meteo' },
    ])
  })

  it('coherencia snow.cm/snow.present: AEMET dice que no nieva (categórico) pero Open-Meteo da cm > 0 — manda cm', () => {
    const aemetSaysNoSnow: WeatherBlock = { ...primary, snow: { cm: null, present: false } }
    const attempt: ComplementAttempt = { status: 'ok', values: { 'snow.cm': 2 } }
    const result = combineWeatherBlock(aemetSaysNoSnow, 'aemet', 'open-meteo', ['snow.cm'], attempt)

    expect(result.block.snow).toEqual({ cm: 2, present: true })
  })

  it('combina las 4 métricas de Portugal (precipitation.mm, snow.cm, wind.speedKmh, wind.gustKmh)', () => {
    const ipmaPrimary: WeatherBlock = {
      ...primary,
      wind: { speedKmh: null, gustKmh: null },
    }
    const attempt: ComplementAttempt = {
      status: 'ok',
      values: {
        'precipitation.mm': 5.5,
        'snow.cm': 0,
        'wind.speedKmh': 22,
        'wind.gustKmh': 40,
      },
    }
    const result = combineWeatherBlock(
      ipmaPrimary,
      'ipma',
      'open-meteo',
      COMPLEMENT_METRICS_BY_PRIMARY_SOURCE.ipma,
      attempt,
    )

    expect(result.block.precipitation).toEqual({ mm: 5.5, probabilityPercent: 10 })
    expect(result.block.snow).toEqual({ cm: 0, present: false })
    expect(result.block.wind).toEqual({ speedKmh: 22, gustKmh: 40 })
    expect(result.provenance.complementary).toEqual({
      'precipitation.mm': 'open-meteo',
      'snow.cm': 'open-meteo',
      'wind.speedKmh': 'open-meteo',
      'wind.gustKmh': 'open-meteo',
    })
    expect(result.degradations).toEqual([])
  })
})
