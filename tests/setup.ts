import { vi, beforeEach } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true })
Object.defineProperty(globalThis, 'Blob', { value: NodeBlob, configurable: true })
Object.defineProperty(window, 'Blob', { value: NodeBlob, configurable: true })
Object.defineProperty(globalThis, 'BroadcastChannel', { value: undefined, configurable: true })
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: 'Tab Paracetamol 500 mg CBC Dengue NS1 report text long enough to count as digital text' }] }) }) }) }) }))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker.js' }))
vi.mock('tesseract.js', () => ({ createWorker: async () => ({ recognize: async () => ({ data: { text: 'x', confidence: 90 } }), terminate: async () => {} }) }))

export const spoken: { text: string; lang: string }[] = []
export const heard: { next: string } = { next: '' }
beforeEach(() => {
  localStorage.clear(); spoken.length = 0; heard.next = ''
  class Utt { text: string; lang = ''; voice: unknown; rate = 1; constructor(t: string) { this.text = t } }
  ;(globalThis as any).SpeechSynthesisUtterance = Utt
  ;(window as any).speechSynthesis = { cancel() {}, getVoices: () => [], speak: (u: Utt) => spoken.push({ text: u.text, lang: u.lang }) }
  class Rec { lang = ''; onstart: any; onend: any; onerror: any; onresult: any; continuous = false; interimResults = false
    start() { setTimeout(() => { this.onstart?.(); this.onresult?.({ results: [[{ transcript: heard.next }]] }); this.onend?.() }, 0) } stop() {} }
  ;(window as any).webkitSpeechRecognition = Rec
  window.scrollTo = (() => {}) as typeof window.scrollTo
})
