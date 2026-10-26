// Exports a review sheet for all NIDAN UI, portal and clinical strings in all 23 supported languages.
// Machine-drafted resources still require native-speaker and qualified clinician review.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dict } from '../src/i18n'
import { languages } from '../src/data/languages'

type Catalog = { uiEnglish: Record<string, string>; textEnglish: Record<string, string>; clinicalEnglish: Record<string, string> }
const catalog = JSON.parse(readFileSync('src/data/localization-source.json', 'utf8')) as Catalog
const locale = JSON.parse(readFileSync('src/locales.json', 'utf8')) as Record<string, Record<string, string>>
const quote = (value: string) => `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
const locales = languages.map((language) => language.code)
const rows: string[][] = [['kind', 'key', 'english', ...locales.map((code) => `lang:${code}`)]]
const valueFor = (code: string, kind: 'ui' | 'text' | 'clinical', key: string, english: string) => {
  if (code === 'en-IN') return english
  const base = code.split('-')[0]
  if (kind === 'ui' && (base === 'hi' || base === 'mr')) return dict[key]?.[base === 'mr' ? 1 : 2] ?? english
  const resourceKey = kind === 'ui' ? key : kind === 'text' ? `text:${key}` : `clinical:${key}`
  return locale[base]?.[resourceKey] ?? ''
}
for (const [key, english] of Object.entries(catalog.uiEnglish)) rows.push(['ui', key, english, ...locales.map((code) => valueFor(code, 'ui', key, english))])
for (const [english, value] of Object.entries(catalog.textEnglish)) rows.push(['text', english, value, ...locales.map((code) => valueFor(code, 'text', english, value))])
for (const [stableKey, value] of Object.entries(catalog.clinicalEnglish)) rows.push(['clinical', stableKey.replace(/^clinical:/, ''), value, ...locales.map((code) => valueFor(code, 'clinical', stableKey.replace(/^clinical:/, ''), value))])
mkdirSync('docs', { recursive: true })
writeFileSync('docs/translation-sheet.csv', '\ufeff' + rows.map((row) => row.map(quote).join(',')).join('\n') + '\n')
console.log(`docs/translation-sheet.csv: ${rows.length - 1} strings × ${locales.length} languages`)
