// Copies Tesseract worker, WASM core and language data into public/ocr so OCR works with NO internet (English, Hindi, Marathi).
import { cpSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
const out = 'public/ocr'; mkdirSync(`${out}/core`, { recursive: true }); mkdirSync(`${out}/lang`, { recursive: true })
const worker = 'node_modules/tesseract.js/dist/worker.min.js'
if (!existsSync(worker)) throw new Error(`Required Tesseract worker is missing: ${worker}`)
cpSync(worker, `${out}/worker.min.js`)
const coreDir = 'node_modules/tesseract.js-core'
const cores = existsSync(coreDir) ? readdirSync(coreDir).filter((f) => /^tesseract-core(-simd)?-lstm\.wasm\.js$/.test(f)) : []
if (!cores.length) throw new Error('Required Tesseract WASM core is missing from node_modules/tesseract.js-core')
for (const f of cores) cpSync(`${coreDir}/${f}`, `${out}/core/${f}`)
for (const l of ['eng', 'hin', 'mar']) {
  const src = `node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`
  if (!existsSync(src)) throw new Error(`Required local OCR language pack is missing: ${src}`)
  cpSync(src, `${out}/lang/${l}.traineddata.gz`)
}
console.log(`OCR assets copied to ${out} (English, Hindi, Marathi; ${cores.length} WASM core variants)`)
