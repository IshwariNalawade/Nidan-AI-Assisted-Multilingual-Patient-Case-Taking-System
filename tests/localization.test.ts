import { describe, expect, it } from 'vitest'
import { languages } from '../src/data/languages'
import { hasUiTranslation, isRtl, uiTier } from '../src/i18n'

describe('all-language localization capability', () => {
  it('retains the complete 23-language catalogue and a locale resource for every option', () => {
    expect(languages).toHaveLength(23)
    expect(new Set(languages.map((language) => language.code)).size).toBe(23)
    for (const language of languages) expect(hasUiTranslation(language.code)).toBe(true)
  })

  it('keeps machine-drafted languages visibly marked for review', () => {
    for (const language of languages) {
      expect(uiTier(language.code)).toBe(language.code === 'en-IN' ? 'full' : 'draft')
    }
  })

  it('uses right-to-left layout for Perso-Arabic Urdu, Sindhi and Kashmiri', () => {
    expect(isRtl('ur-IN')).toBe(true)
    expect(isRtl('sd-IN')).toBe(true)
    expect(isRtl('ks-IN')).toBe(true)
    expect(isRtl('hi-IN')).toBe(false)
    expect(isRtl('en-IN')).toBe(false)
  })
})
