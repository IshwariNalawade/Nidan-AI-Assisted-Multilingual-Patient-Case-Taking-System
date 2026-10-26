import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { uiEnglishSource } from '../src/i18n.js'
import { languages } from '../src/data/languages.js'
import { symptomModules } from '../src/data/clinical.js'
import { AYUSH_SYSTEMS, REGIONS, symTr } from '../src/data/ui-data.js'
import { optTr, qTr } from '../src/data/qtr.js'

const root = process.cwd()
const targetDir = path.join(root, 'src/data')
const outputPath = path.join(targetDir, 'localization-source.json')
const text: Record<string, string> = {}
const clinical: Record<string, string> = {}
const addText = (value: string) => {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (cleaned && /[A-Za-z]/.test(cleaned)) text[`text:${cleaned}`] = cleaned
}
const addClinical = (key: string, value: string) => {
  if (value.trim()) clinical[`clinical:${key}`] = value.trim()
}
const callName = (node: ts.CallExpression) => ts.isIdentifier(node.expression) ? node.expression.text : ''
const readStatic = (node: ts.Expression | undefined): string | null => {
  if (!node) return null
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return null
}

function scanFile(file: string) {
  const source = readFileSync(file, 'utf8')
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = callName(node)
      if (['_t', 't', 'setMsg', 'setFail', 'setError', 'setSuccess'].includes(name)) addText(readStatic(node.arguments[0]) ?? '')
      if (name === 'confirm' && node.arguments[0]) addText(readStatic(node.arguments[0]) ?? '')
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && ['ApiError', 'Error'].includes(node.expression.text)) {
      const message = node.arguments?.[1] ?? node.arguments?.[0]
      addText(readStatic(message) ?? '')
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      if (['title', 'aria-label', 'placeholder', 'alt', 'label'].includes(node.name.getText(ast))) addText(node.initializer.text)
    }
    if (ts.isPropertyAssignment(node) && ['label', 'title', 'message', 'note'].includes(node.name.getText(ast))) {
      addText(readStatic(node.initializer) ?? '')
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(file)
    return /\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [file] : []
  })
}

for (const file of [path.join(root, 'src/App.tsx'), ...walk(path.join(root, 'src/components')), ...walk(path.join(root, 'src/lib')), path.join(root, 'src/lib/report.ts'), ...walk(path.join(root, 'server/api'))]) {
  if (existsSync(file)) scanFile(file)
}
for (const value of [
  'All', 'All cases', 'Waiting', 'Pending', 'Triaged', 'Referred', 'Submitted', 'Reviewed', 'Draft', 'Routine', 'Urgent',
  'Alerts', 'Patients', 'Data', 'Metrics', 'Audit', 'Settings', 'Confirmed', 'Unknown', 'Rejected', 'Uploaded', 'Processed',
  'Needs review', 'Needs-review', 'Supported', 'Limited', 'Fallback', 'Browser dependent', 'Browser-dependent', 'System-dependent',
  'Just now', 'just now', '{minutes} min ago', '{hours} h ago', '{minutes} min {seconds} s', '{rate}% of {attempts} attempts',
  'NIDAN urgent', 'NIDAN — Staff', 'Sent to endpoint', 'No endpoint configured or send failed (VITE_FHIR_ENDPOINT)', 'Marked reviewed',
  'This record will be deleted permanently?',
  'General', 'Ayush', 'Hospital', 'Clinic', 'Not provided', 'No answers recorded.', 'Yes', 'No',
  'Cases in your queue', 'Cases visible', 'Waiting for review', 'Urgent rule flags', 'Reviewed', 'Awaiting triage',
  'No organization assigned', 'organization-scoped queue', 'No token', 'Not routed', 'years', 'confidence',
  'Family history', 'Additional notes', 'Long term conditions', 'Regular medicines',
  'FHIR', 'unknown', 'confirmed', 'unverified', 'processed', 'rejected', 'uploaded',
  'Unverified — staff must check against the original', 'Patient-confirmed OCR text', 'Rule-based draft', 'AI-generated draft'
]) addText(value)

for (const module of symptomModules) {
  addClinical(`symptom:${module.key}:label`, module.label)
  addClinical(`symptom:${module.key}:shortLabel`, module.shortLabel)
  addClinical(`symptom:${module.key}:description`, module.description)
  for (const question of module.questions) {
    addClinical(`question:${question.id}:label`, question.label)
    if (question.helper) addClinical(`question:${question.id}:helper`, question.helper)
    if (question.placeholder) addClinical(`question:${question.id}:placeholder`, question.placeholder)
    const options = question.options ?? []
    for (let index = 0; index < options.length; index++) addClinical(`question:${question.id}:option:${index}`, options[index])
  }
}
for (const region of REGIONS) addClinical(`region:${region.id}`, region.en)
for (const system of AYUSH_SYSTEMS) addClinical(`ayush:${system.id}`, system.en)
for (const module of symptomModules) for (const question of module.questions) {
  if (question.options) for (let index = 0; index < question.options.length; index++) {
    const option = question.options[index]
    if (!optTr[option]) clinical[`clinical:question:${question.id}:option:${index}`] = option
  }
}

const textSorted = Object.fromEntries(Object.entries(text).sort(([a], [b]) => a.localeCompare(b)))
const clinicalSorted = Object.fromEntries(Object.entries(clinical).sort(([a], [b]) => a.localeCompare(b)))
const localeTasks = Object.fromEntries(languages.filter((language) => language.code !== 'en-IN').map((language) => {
  const base = language.code.split('-')[0]
  const existingClinical = { ...clinicalSorted }
  if (base === 'hi' || base === 'mr') {
    const index = base === 'mr' ? 0 : 1
    for (const module of symptomModules) {
      if (symTr[module.key]?.[index]) delete existingClinical[`clinical:symptom:${module.key}:label`]
      for (const question of module.questions) {
        if (qTr[question.id]?.[index]) delete existingClinical[`clinical:question:${question.id}:label`]
        for (let optionIndex = 0; optionIndex < (question.options ?? []).length; optionIndex++) {
          if (optTr[question.options![optionIndex]]) delete existingClinical[`clinical:question:${question.id}:option:${optionIndex}`]
        }
      }
    }
    for (const region of REGIONS) delete existingClinical[`clinical:region:${region.id}`]
    for (const system of AYUSH_SYSTEMS) delete existingClinical[`clinical:ayush:${system.id}`]
  }
  return [language.code, {
    name: language.name,
    nativeName: language.nativeName,
    script: language.script,
    translateUi: base !== 'hi' && base !== 'mr',
    preserveClinicalKeys: Object.keys(clinicalSorted).filter((key) => !(key in existingClinical))
  }]
}))

const catalog = { version: 1, localeCodes: languages.map((language) => language.code), uiEnglish: uiEnglishSource, textEnglish: textSorted, clinicalEnglish: clinicalSorted, localeTasks }
mkdirSync(targetDir, { recursive: true })
writeFileSync(outputPath, JSON.stringify(catalog, null, 2) + '\n')
console.log(JSON.stringify({ outputPath, locales: Object.keys(localeTasks).length + 1, uiKeys: Object.keys(uiEnglishSource).length, textKeys: Object.keys(textSorted).length, clinicalKeys: Object.keys(clinicalSorted).length, questionCount: symptomModules.reduce((sum, module) => sum + module.questions.length, 0) }, null, 2))
