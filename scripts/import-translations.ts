// Merges a filled translation sheet back into src/locales.json (UI) and src/data/qlocales.json (clinical questions). Empty cells are ignored.
import { readFileSync, writeFileSync } from 'node:fs'
const file = process.argv[2] ?? 'docs/translation-sheet.csv'
function parse(t: string) { const rows: string[][] = []; let row: string[] = [], cur = '', inq = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (inq) { if (c === '"' && t[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') inq = false; else cur += c } else if (c === '"') inq = true; else if (c === ',') { row.push(cur); cur = '' } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = '' } else cur += c } if (cur || row.length) { row.push(cur); rows.push(row) } return rows }
const rows = parse(readFileSync(file, 'utf8').replace(/^\ufeff/, '')), head = rows[0]
const ui = JSON.parse(readFileSync('src/locales.json', 'utf8')) as Record<string, Record<string, string>>, ql = JSON.parse(readFileSync('src/data/qlocales.json', 'utf8')) as Record<string, Record<string, string>>
let n = 0, bad = 0
for (const r of rows.slice(1)) head.forEach((h, c) => { if (!h.startsWith('lang:') || !r[c]?.trim()) return; const l = h.slice(5), tgt = r[0] === 'ui' ? ui : ql; if (r[0] === 'ui' && /\{x\}/.test(r[2]) && !/\{x\}/.test(r[c])) { bad++; console.warn(`SKIP ${l}.${r[1]}: placeholder {x} missing`); return } (tgt[l] ??= {})[r[1]] = r[c].trim(); n++ })
writeFileSync('src/locales.json', JSON.stringify(ui, null, 0)); writeFileSync('src/data/qlocales.json', JSON.stringify(ql, null, 0)); console.log(`imported ${n} strings, skipped ${bad}`)
