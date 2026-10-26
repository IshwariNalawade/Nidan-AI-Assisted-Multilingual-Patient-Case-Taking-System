import { readFileSync } from 'node:fs'
import { languages, languageByCode } from '../src/data/languages.js'
import { hasUiTranslation, isRtl, makeUi, uiTier } from '../src/i18n.js'

type Catalog = {
  localeCodes: string[]
  uiEnglish: Record<string, string>
  textEnglish: Record<string, string>
  clinicalEnglish: Record<string, string>
  localeTasks: Record<string, { translateUi: boolean; preserveClinicalKeys: string[] }>
}
const expected = ['en-IN', 'as-IN', 'bn-IN', 'brx-IN', 'doi-IN', 'gu-IN', 'hi-IN', 'kn-IN', 'ks-IN', 'kok-IN', 'mai-IN', 'ml-IN', 'mni-IN', 'mr-IN', 'ne-IN', 'or-IN', 'pa-IN', 'sa-IN', 'sat-IN', 'sd-IN', 'ta-IN', 'te-IN', 'ur-IN']
const actual = languages.map((language) => language.code)
const missing = expected.filter((code) => !actual.includes(code))
const duplicate = actual.filter((code, index) => actual.indexOf(code) !== index)
const invalid = languages.filter((language) => !language.name || !language.nativeName || !language.voiceTag || !['reviewed', 'partial', 'needs-review'].includes(language.translation))
if (missing.length || duplicate.length || invalid.length || actual.length !== expected.length) {
  console.error(JSON.stringify({ expected: expected.length, actual: actual.length, missing, duplicate, invalid: invalid.map((language) => language.code) }, null, 2))
  process.exit(1)
}

const catalog = JSON.parse(readFileSync('src/data/localization-source.json', 'utf8')) as Catalog
const resources = JSON.parse(readFileSync('src/locales.json', 'utf8')) as Record<string, Record<string, string>>
const problems: string[] = []
const tokenList = (value: string) => Array.from(value.matchAll(/\{[A-Za-z0-9_]+\}/g)).map((match) => match[0]).sort().join('|')
for (const language of languages) {
  const code = language.code
  const base = code.split('-')[0]
  if (!hasUiTranslation(code)) problems.push(`${code}: no UI translation resource`)
  const tier = uiTier(code)
  if (tier !== (code === 'en-IN' ? 'full' : 'draft')) problems.push(`${code}: unexpected translation tier ${tier}`)
  if (isRtl(code) !== ['ks-IN', 'sd-IN', 'ur-IN'].includes(code)) problems.push(`${code}: unexpected text direction`)
  if (code === 'en-IN') continue
  const task = catalog.localeTasks[code]
  const dictionary = resources[base] ?? {}
  const requiredUi = task.translateUi ? Object.entries(catalog.uiEnglish).map(([key, source]) => [key, source] as const) : []
  const requiredText = Object.entries(catalog.textEnglish).map(([source, value]) => [`text:${source}`, value] as const)
  const preserved = new Set(task.preserveClinicalKeys)
  const requiredClinical = Object.entries(catalog.clinicalEnglish).filter(([key]) => !preserved.has(key)).map(([key, value]) => [key, value] as const)
  for (const [key, source] of [...requiredUi, ...requiredText, ...requiredClinical]) {
    const translated = dictionary[key]
    if (typeof translated !== 'string' || !translated.trim()) {
      problems.push(`${code}: missing ${key}`)
      continue
    }
    if (tokenList(source) !== tokenList(translated)) problems.push(`${code}: placeholder mismatch ${key}`)
  }
  const ui = makeUi(code)
  for (const [key, source] of Object.entries(catalog.uiEnglish)) {
    if (!ui(key).trim()) problems.push(`${code}: empty UI label ${key}`)
    if (code !== 'hi-IN' && code !== 'mr-IN' && ui(key) !== dictionary[key]) problems.push(`${code}: UI translator did not resolve ${key}`)
  }
}
if (problems.length) {
  console.error(`Localization validation failed (${problems.length} issue(s))`)
  console.error(problems.slice(0, 120).join('\n'))
  if (problems.length > 120) console.error(`… ${problems.length - 120} more`)
  process.exit(1)
}
console.log(`Localization resources complete: ${languages.length} languages; ${Object.keys(catalog.uiEnglish).length} core UI keys, ${Object.keys(catalog.textEnglish).length} additional UI/message keys, ${Object.keys(catalog.clinicalEnglish).length} clinical keys across 98 follow-up questions. All non-English resources remain marked draft/needs-review; native-speaker and clinician review is still required.`)
