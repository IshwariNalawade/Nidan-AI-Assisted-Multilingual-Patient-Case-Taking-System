// Generates docs/clinical-review.csv: every red-flag rule, every Marathi/Hindi clinical question and every safety/consent string,
// laid out beside its English source, with empty columns for a clinician / translator to fill in.  Run: npm run review-sheet
import { writeFileSync, mkdirSync } from 'node:fs'
import { CONCEPTS } from '../src/lib/safety'
import { symptomModules } from '../src/data/clinical'
import { qTr } from '../src/data/qtr'
import { dict } from '../src/i18n'
const q = (s: string) => `"${String(s).replace(/"/g, '""').replace(/\n/g, ' ')}"`
const rows: string[][] = [['type', 'id', 'language', 'english_or_label', 'text_or_pattern', 'tier', 'reviewer_name_and_reg_no', 'decision(approve/change/reject)', 'comment']]
for (const c of CONCEPTS) rows.push(['red-flag rule', c.id, 'multi', c.label, c.pats.map((p) => p.map((g) => '[' + g.slice(0, 14).join(' | ') + (g.length > 14 ? ' …' : '') + ']').join(' + ')).join('  OR  '), c.tier + (c.gate ? ' (only with age/pregnancy context)' : ''), '', '', ''])
for (const m of symptomModules) for (const qu of m.questions) { const t = qTr[qu.id]; rows.push(['question', qu.id, 'mr', qu.label, t?.[0] ?? '(not translated)', '', '', '', '']); rows.push(['question', qu.id, 'hi', qu.label, t?.[1] ?? '(not translated)', '', '', '', '']) }
for (const k of ['c1', 'c2', 'c3', 'c4', 'emTitle', 'emBody', 'safeNone', 'voiceBody', 'guardian', 'alertSent', 'alertQueued', 'handwriting', 'disclaimer', 'handoff']) { const d = dict[k]; if (d) { rows.push(['ui-string', k, 'mr', d[0], d[1], '', '', '', '']); rows.push(['ui-string', k, 'hi', d[0], d[2], '', '', '', '']) } }
mkdirSync('docs', { recursive: true }); writeFileSync('docs/clinical-review.csv', '\ufeff' + rows.map((r) => r.map(q).join(',')).join('\n'))
console.log(`docs/clinical-review.csv: ${rows.length - 1} rows`)
