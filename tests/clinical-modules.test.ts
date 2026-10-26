import { describe, expect, it } from 'vitest'
import { symptomModules } from '../src/data/clinical'
import { qTr } from '../src/data/qtr'
import { symTr } from '../src/data/ui-data'

describe('patient-reported symptom intake modules', () => {
  it('keeps all existing categories and adds the eight requested concern groups', () => {
    const keys = symptomModules.map((module) => module.key)
    expect(keys).toEqual(expect.arrayContaining([
      'headache', 'fever', 'cough', 'stomach', 'chest', 'vomiting', 'rash', 'dizziness', 'joint', 'urinary', 'fatigue',
      'bloodSugar', 'bloodPressure', 'eye', 'earNoseThroat', 'dental', 'allergy', 'menstrual', 'injury',
    ]))
    expect(new Set(keys).size).toBe(keys.length)
    expect(Object.keys(symTr)).toHaveLength(keys.length)
  })

  it('gives every selectable module its own follow-ups and translated question wording', () => {
    const ids = symptomModules.flatMap((module) => {
      expect(module.questions.length).toBeGreaterThanOrEqual(4)
      expect(module.questions.every((question) => question.label.trim().length > 0)).toBe(true)
      return module.questions.map((question) => question.id)
    })
    expect(new Set(ids).size).toBe(ids.length)
    for (const module of symptomModules.slice(11)) {
      for (const question of module.questions) {
        expect(qTr[question.id], `${question.id} should have Hindi and Marathi draft wording`).toHaveLength(2)
      }
    }
  })
})
