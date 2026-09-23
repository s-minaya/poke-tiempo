import { describe, expect, it } from 'vitest'

import type { Tone } from '../../domain/oak/plan-dialogues.ts'
import { POSE_SOURCES, isTone, poseFor } from './oak-pose.ts'

const TONES: Tone[] = ['neutral', 'cientifico', 'epico', 'consejo', 'guasa']

describe('poseFor — un día normal', () => {
  it.each([
    ['neutral', 'neutral'],
    ['cientifico', 'confused'],
    ['epico', 'epic'],
    ['consejo', 'warning'],
    ['guasa', 'playful'],
  ] as const)('%s → oak-%s', (tone, pose) => {
    expect(poseFor(tone, false)).toBe(pose)
  })
})

describe('poseFor — un día serio', () => {
  it.each(TONES)('%s nunca pone la cara de broma ni la de asombro', (tone) => {
    expect(poseFor(tone, true)).not.toBe('playful')
    expect(poseFor(tone, true)).not.toBe('epic')
  })

  it('lo que pide atención va con la cara de aviso', () => {
    expect(poseFor('consejo', true)).toBe('warning')
    expect(poseFor('epico', true)).toBe('warning')
  })

  it('el resto, con la neutra — también una guasa que se hubiera colado', () => {
    expect(poseFor('neutral', true)).toBe('neutral')
    expect(poseFor('cientifico', true)).toBe('neutral')
    expect(poseFor('guasa', true)).toBe('neutral')
  })
})

describe('recursos', () => {
  it('cada pose tiene su WebP', () => {
    for (const source of Object.values(POSE_SOURCES)) expect(source).toMatch(/oak-\w+\.webp/)
  })

  it('oak-tired no entra en el mapping: ningún tono la pide todavía', () => {
    expect(Object.keys(POSE_SOURCES)).not.toContain('tired')
    for (const tone of TONES) for (const serious of [false, true]) expect(poseFor(tone, serious)).not.toBe('tired')
  })

  it('isTone reconoce los cinco tonos y nada más', () => {
    for (const tone of TONES) expect(isTone(tone)).toBe(true)
    for (const other of ['misterio', '', 'Neutral', 42, null, undefined]) expect(isTone(other)).toBe(false)
  })
})
