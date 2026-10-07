import { describe, expect, it } from 'vitest'

import { RELATIVE_DAY_WORDS, RELATIVE_TIME_PHRASES, findRelativeTimeExpression } from './relative-time-expressions.ts'

describe('las listas del contrato', () => {
  it('cinco palabras, exactamente', () => {
    expect(RELATIVE_DAY_WORDS).toEqual(['hoy', 'mañana', 'ayer', 'anoche', 'anteayer'])
  })

  it('cuatro frases, exactamente', () => {
    expect(RELATIVE_TIME_PHRASES).toEqual(['esta mañana', 'esta tarde', 'esta noche', 'esta madrugada'])
  })
})

describe('findRelativeTimeExpression — palabras', () => {
  it.each([
    { text: 'Hoy hay 7 lugares bajo aviso.', expression: 'hoy' },
    { text: 'HOY llueve en Jaca.', expression: 'hoy' },
    { text: 'Mañana sigue la lluvia.', expression: 'mañana' },
    { text: 'MAÑANA sigue la lluvia.', expression: 'mañana' },
    { text: 'manana sigue la lluvia.', expression: 'mañana' },
    { text: 'Lloverá por la mañana en Ourense.', expression: 'mañana' },
    { text: 'La mañana del lunes llega con niebla.', expression: 'mañana' },
    { text: 'Ayer ya llovía.', expression: 'ayer' },
    { text: 'Anoche cayó granizo.', expression: 'anoche' },
    { text: 'Como anteayer, Zapdos.', expression: 'anteayer' },
  ])('«$text» → $expression', ({ text, expression }) => {
    expect(findRelativeTimeExpression(text)).toEqual({ kind: 'word', expression })
  })
})

describe('findRelativeTimeExpression — frases', () => {
  it.each([
    { text: 'Esta mañana hay niebla.', expression: 'esta mañana' },
    { text: 'Esta tarde llueve.', expression: 'esta tarde' },
    { text: 'Esta noche refresca.', expression: 'esta noche' },
    { text: 'ESTA MADRUGADA hiela.', expression: 'esta madrugada' },
    { text: 'esta manana hay niebla.', expression: 'esta mañana' },
    { text: 'Esta  tarde llueve.', expression: 'esta tarde' },
    { text: 'Atención:\testa\nnoche refresca.', expression: 'esta noche' },
  ])('«$text» → $expression', ({ text, expression }) => {
    expect(findRelativeTimeExpression(text)).toEqual({ kind: 'phrase', expression })
  })
})

describe('findRelativeTimeExpression — «estamos a» con fecha', () => {
  it.each([
    { text: 'Estamos a lunes.', expression: 'estamos a lunes' },
    { text: 'Estamos a martes.', expression: 'estamos a martes' },
    { text: 'Estamos a miércoles.', expression: 'estamos a miercoles' },
    { text: 'estamos a miercoles', expression: 'estamos a miercoles' },
    { text: 'Estamos a jueves.', expression: 'estamos a jueves' },
    { text: 'Estamos a viernes.', expression: 'estamos a viernes' },
    { text: 'Estamos a sábado, fin de semana.', expression: 'estamos a sabado' },
    { text: 'estamos a sabado', expression: 'estamos a sabado' },
    { text: 'Estamos a domingo.', expression: 'estamos a domingo' },
    { text: 'Estamos a 5 de octubre.', expression: 'estamos a 5 de octubre' },
    { text: 'Estamos  a   lunes.', expression: 'estamos a lunes' },
    { text: 'estamos a 5  de  octubre', expression: 'estamos a 5 de octubre' },
  ])('«$text» → $expression', ({ text, expression }) => {
    expect(findRelativeTimeExpression(text)).toEqual({ kind: 'reading-date', expression })
  })
})

describe('findRelativeTimeExpression — permitido', () => {
  it.each([
    'El lunes hay niebla en Ourense.',
    'La previsión es para el lunes 5 de octubre.',
    'La tarde del lunes.',
    'Durante la tarde del lunes llueve en Jaca.',
    'La noche del lunes.',
    'Estamos a 30 grados.',
    'Estamos a 1000 metros.',
    'Estamos a 5 de distancia.',
    'Estamos ante un día curioso.',
    'Este mapa merece una nota.',
    'Ahora toca observar.',
    'Hay un hoyo en el camino.',
    'Un Pokémon mañanero.',
    'Ayerbe, en Huesca.',
    'Un tardeo con Castform.',
  ])('«%s»', (text) => {
    expect(findRelativeTimeExpression(text)).toBeNull()
  })
})

describe('findRelativeTimeExpression — prioridad', () => {
  it('«esta mañana» se informa como frase y no como la palabra «mañana»', () => {
    expect(findRelativeTimeExpression('Esta mañana, niebla.')).toEqual({ kind: 'phrase', expression: 'esta mañana' })
  })

  it('con varias, informa de la primera que encuentra según el orden: frases, «estamos a», palabras', () => {
    expect(findRelativeTimeExpression('Hoy estamos a lunes.')).toEqual({ kind: 'reading-date', expression: 'estamos a lunes' })
  })
})
