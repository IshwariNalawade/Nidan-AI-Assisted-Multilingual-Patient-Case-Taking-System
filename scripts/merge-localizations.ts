import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { languages } from '../src/data/languages.js'

type LocaleDraft = { locale: string; ui: Record<string, string>; text: Record<string, string>; clinical: Record<string, string> }
type Catalog = { uiEnglish: Record<string, string>; textEnglish: Record<string, string>; clinicalEnglish: Record<string, string>; localeTasks: Record<string, { translateUi: boolean; preserveClinicalKeys: string[] }> }
const catalog = JSON.parse(readFileSync('src/data/localization-source.json', 'utf8')) as Catalog
const resources = JSON.parse(readFileSync('src/locales.json', 'utf8')) as Record<string, Record<string, string>>
const tokenList = (value: string) => Array.from(value.matchAll(/\{[A-Za-z0-9_]+\}/g)).map((match) => match[0]).sort().join('|')
const errors: string[] = []
const prepared: Array<{ code: string; base: string; entries: Record<string, string> }> = []
for (const language of languages.filter((item) => item.code !== 'en-IN')) {
  const code = language.code
  const base = code.split('-')[0]
  const file = resolve('src/data/locales-drafts', `${code}.json`)
  if (!existsSync(file)) { errors.push(`${code}: missing ${file}`); continue }
  let draft: LocaleDraft
  try { draft = JSON.parse(readFileSync(file, 'utf8')) as LocaleDraft }
  catch { errors.push(`${code}: invalid JSON`); continue }
  if (draft.locale !== code || !draft.ui || !draft.text || !draft.clinical) { errors.push(`${code}: invalid locale file shape`); continue }
  const task = catalog.localeTasks[code]
  const expectedUi = task.translateUi ? Object.keys(catalog.uiEnglish) : []
  const expectedText = Object.keys(catalog.textEnglish).map((source) => `text:${source}`)
  const preserved = new Set(task.preserveClinicalKeys)
  const expectedClinical = Object.keys(catalog.clinicalEnglish).filter((key) => !preserved.has(key))
  const verify = (kind: 'ui' | 'text' | 'clinical', expected: string[], sourceMap: Record<string, string>, prefixes: boolean) => {
    const actualKeys = Object.keys(draft[kind])
    const allowed = new Set(kind === 'clinical' ? expected.flatMap((key) => [key, `clinical:${key}`]) : expected)
    for (const key of expected) {
      const writtenKey = kind === 'clinical' && draft[kind][key] === undefined && draft[kind][`clinical:${key}`] !== undefined ? `clinical:${key}` : key
      const target = draft[kind][writtenKey]
      const sourceKey = kind === 'ui' ? key : kind === 'text' ? key.slice(5) : key
      const source = sourceMap[sourceKey]
      if (typeof target !== 'string' || !target.trim()) { errors.push(`${code}: missing ${kind}.${key}`); continue }
      if (tokenList(source) !== tokenList(target)) errors.push(`${code}: placeholder mismatch ${kind}.${key}`)
    }
    for (const key of actualKeys) if (!allowed.has(key)) errors.push(`${code}: unexpected ${kind}.${key}`)
  }
  verify('ui', expectedUi, catalog.uiEnglish, false)
  verify('text', expectedText, catalog.textEnglish, false)
  verify('clinical', expectedClinical, catalog.clinicalEnglish, true)
  const entries: Record<string, string> = {}
  Object.assign(entries, draft.ui, draft.text)
  for (const key of expectedClinical) entries[key] = draft.clinical[key] ?? draft.clinical[`clinical:${key}`]
  prepared.push({ code, base, entries })
}
if (errors.length) {
  console.error(`Locale merge stopped; ${errors.length} issue(s) found. No resources were written.`)
  console.error(errors.slice(0, 150).join('\n'))
  if (errors.length > 150) console.error(`… ${errors.length - 150} more`)
  process.exit(1)
}
for (const locale of prepared) resources[locale.base] = { ...(resources[locale.base] ?? {}), ...locale.entries }
writeFileSync('src/locales.json', JSON.stringify(resources, null, 2) + '\n')
console.log(`Merged ${prepared.length} locale files; retained ${Object.keys(resources).length} language resources. Run npm run languages:validate before shipping.`)
