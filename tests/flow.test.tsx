import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { newSession, type Session } from '../src/model'
import { heard, spoken } from './setup'
import { spokenNumber, matchChoice } from '../src/lib/parse'
import { findFields, validateFile } from '../src/lib/ocr'
import { questionQueue, safetyTriggers } from '../src/lib/report'
import { makeUi } from '../src/i18n'

vi.mock('../src/lib/ocr', async (orig) => ({
  ...(await orig<typeof import('../src/lib/ocr')>()),
  readImage: async () => ({ text: 'Tab Paracetamol 500 mg\nCBC, Dengue NS1\nAllergy: none known\nTemperature 101.4 F', method: 'ocr' as const, confidence: 88, langs: 'eng+mar+hin' }),
  trimImage: async (s: string) => s,
}))
afterEach(cleanup)
let initial: Partial<Session> = {}
const seed = (p: Partial<Session>) => { initial = p }
const Kiosk = () => <App initial={{ voiceOptIn: 'yes', ...initial }} />
const say = async (text: string, field: HTMLElement) => { const vfield = field.closest('.vfield') as HTMLElement; heard.next = text; fireEvent.click(vfield.querySelector('.mic-btn') as HTMLElement); await waitFor(() => expect(within(vfield).getByText(/I heard:/)).toBeTruthy(), { timeout: 5000 }); return vfield }
afterEach(() => { initial = {} })
const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Save registration)/ }))

describe('pure helpers', () => {
  it('parses spoken numbers', () => { expect(spokenNumber('forty two', 'age')).toBe('42'); expect(spokenNumber('९८७६५ ४३२१०', 'phone')).toBe('9876543210') })
  it('matches only unambiguous choices', () => {
    const c = [{ value: 'male', words: ['male'] }, { value: 'female', words: ['female'] }]
    expect(matchChoice('I am female', c)).toBe('female'); expect(matchChoice('male or female', c)).toBeNull(); expect(matchChoice('banana', c)).toBeNull()
  })
  it('rule-based fields only copy matching lines', () => { const f = findFields('Tab Paracetamol 500 mg\nCBC\nhello'); expect(f.medicines).toHaveLength(1); expect(f.tests).toEqual(['CBC']); expect(f.allergies).toEqual([]) })
  it('validates uploads', () => { expect(validateFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBe(true); expect(validateFile(new File(['x'], 'a.exe', { type: 'application/x-msdownload' }))).toBe(false) })
})

describe('language and read-aloud', () => {
  it('Marathi UI + Marathi voice', async () => {
    seed({ lang: 'mr-IN', step: 'consent' }); render(<Kiosk />)
    expect(screen.getAllByText('संमती').length).toBeGreaterThan(0); expect(screen.getByText('पुढे जा')).toBeTruthy()
    await waitFor(() => expect(spoken.some((x) => x.lang === 'mr-IN')).toBe(true), { timeout: 2000 })
  })
  it('Hindi UI', () => { seed({ lang: 'hi-IN', step: 'consent' }); render(<Kiosk />); expect(screen.getByText('आगे बढ़ें')).toBeTruthy() })
  it('a language with no translation (Kashmiri) falls back to English and says so', () => {
    seed({ lang: 'ks-IN', step: 'language' }); render(<Kiosk />)
    expect(screen.getByText(/shown in English for this language/)).toBeTruthy()
  })
  it('Gujarati now shows translated core screens, flagged as a draft translation', () => {
    seed({ lang: 'gu-IN', step: 'consent' }); render(<Kiosk />)
    expect(screen.getByText('આગળ')).toBeTruthy(); expect(screen.getAllByText('તમારી સંમતિ').length).toBeGreaterThan(0); expect(screen.getAllByText(/Draft translation/).length).toBeGreaterThan(0)
  })
  it('lists 23 language options', () => { seed({ lang: 'en-IN', step: 'language' }); render(<Kiosk />); expect(screen.getAllByRole('radio')).toHaveLength(23) })
})

describe('full intake with voice, OCR, safety, summary', () => {
  it('works end to end', async () => {
    seed({ lang: 'en-IN', step: 'patient' }); render(<Kiosk />)
    fireEvent.click(screen.getByRole('radio', { name: /New patient/ }))
    await say('Sunita Deshmukh', document.getElementById('f-name')!)
    expect((document.getElementById('f-name') as HTMLInputElement).value).toBe('Sunita Deshmukh')
    next(); expect(screen.getByText(/confirm or correct the spoken answer/)).toBeTruthy()           // blocked until confirmed
    fireEvent.click(screen.getByText(/Yes, correct/))
    await say('forty two', document.getElementById('f-age')!); fireEvent.click(screen.getByText(/Yes, correct/))
    expect((document.getElementById('f-age') as HTMLInputElement).value).toBe('42')
    heard.next = 'female'; fireEvent.click(screen.getAllByText(/Speak your choice/)[1]); await waitFor(() => expect(screen.getByRole('button', { name: 'Female' }).getAttribute('aria-pressed')).toBe('true'))
    next(); expect(screen.getAllByText(/Please choose an option/).length).toBeGreaterThan(0)         // pregnancy question is required for a woman aged 12-55
    fireEvent.click(screen.getAllByRole('button', { name: 'No' })[0])
    next()                                                                                           // -> register
    expect((document.getElementById('r-name') as HTMLInputElement).value).toBe('Sunita Deshmukh')
    next()                                                                                           // -> consent
    next(); expect(screen.getByText(/tick the box/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/I understand and agree/)); next()                                            // -> consultation
    heard.next = 'ayush please'; fireEvent.click(screen.getByText(/Speak your choice/)); await waitFor(() => expect(screen.getByRole('radio', { name: /AYUSH consultation/ }).getAttribute('aria-checked')).toBe('true'))
    await waitFor(() => expect(document.querySelector('.app')?.getAttribute('data-step')).toBe('ayushSys'))
    heard.next = 'ayurveda'; fireEvent.click(screen.getByText(/Speak your choice/)); await waitFor(() => expect(screen.getAllByRole('button', { pressed: true }).some((b) => /Ayurveda/.test(b.textContent ?? ''))).toBe(true))
    await waitFor(() => expect(document.querySelector('.app')?.getAttribute('data-step')).toBe('concern'))
    const concernVfield = await say('I have fever since three days', document.getElementById('concern')!)
    fireEvent.click(concernVfield.querySelector('.confirm-bar button.dark') as HTMLElement)
    await waitFor(() => expect(screen.getByText(/This looks like/)).toBeTruthy())
    fireEvent.click(document.querySelector('.note-box.warm button') as HTMLElement); next()                                  // -> body
    heard.next = 'head'; fireEvent.click(screen.getByText(/Speak your choice/)); await waitFor(() => expect(screen.getAllByRole('button', { pressed: true }).length).toBeGreaterThan(0))
    next(); next()                                                                                   // -> ayHist -> questions
    for (let i = 0; i < 15 && !screen.queryByText('Reports', { selector: 'h1' }); i++) {
      if (!screen.queryByText(/QUESTION/)) break
      const ta = document.querySelector('.qcard textarea') as HTMLTextAreaElement | null
      if (ta) fireEvent.change(ta, { target: { value: 'two days, mild' } })
      else if (document.querySelector('.scale')) fireEvent.click(screen.getByRole('radio', { name: '3' }))
      else fireEvent.click(document.querySelector('.qcard .chip') as HTMLElement)
      next()
    }
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeTruthy())
    // upload an image -> trim preview -> OCR (mocked engine) -> editable text + fields
    const file = new File(['x'], 'lab.png', { type: 'image/png' })
    fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, { target: { files: [file] } })
    await waitFor(() => screen.getByText('Add to intake')); fireEvent.click(screen.getByText('Add to intake'))
    await waitFor(() => expect(screen.getByText('Ready')).toBeTruthy())
    expect(screen.getByText(/Tab Paracetamol 500 mg/, { selector: '.fbox p' })).toBeTruthy()
    fireEvent.change(document.querySelector('.doc-card textarea') as HTMLTextAreaElement, { target: { value: 'Tab Paracetamol 500 mg\nsevere chest pain, difficulty breathing' } })
    expect(screen.getAllByText(/Warning signs found/).length).toBeGreaterThan(0)
    // unsupported file is rejected with a readable error
    fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, { target: { files: [new File(['x'], 'v.exe', { type: 'application/x-msdownload' })] } })
    await waitFor(() => expect(screen.getByText(/Only PDF, JPG and PNG/)).toBeTruthy())
    next()                                                                                           // -> safety
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0))
    expect(screen.getAllByText(/Please seek urgent medical help now/).length).toBeGreaterThan(0)
    next()                                                                                           // -> summary
    expect(screen.getByRole('heading', { level: 1, name: 'Summary' })).toBeTruthy()
    expect(within(document.querySelector('.summary') as HTMLElement).getByText(/Sunita Deshmukh/)).toBeTruthy()
    let blob = ''; (URL as any).createObjectURL = (b: Blob) => { b.text().then((t) => (blob = t)); return 'blob:x' }; (URL as any).revokeObjectURL = () => {}
    fireEvent.click(screen.getByText(/Download .txt/)); await waitFor(() => expect(blob).toContain('Sunita Deshmukh'))
    expect(blob).toContain('severe chest pain'); expect(screen.getByText(/Print/)).toBeTruthy()
    next(); expect(screen.getByRole('heading', { level: 1, name: 'Doctor review' })).toBeTruthy()
    await waitFor(() => expect(screen.getAllByText(/NOT saved/).length).toBeGreaterThan(0))   // no staff vault set up: honest message, nothing persisted
    expect(localStorage.getItem('nidan-saved-v3')).toBeNull()
  }, 30000)
  it('safety rules and question queue behave', () => {
    const s = { ...newSession(), symptom: 'chest' as const, concern: 'chest pain right now', answers: { chest_current: 'Yes' } }
    expect(safetyTriggers(s).length).toBeGreaterThan(0)
    expect(questionQueue({ ...s, body: ['lowerBack'] }, makeUi('mr-IN')).some((q) => q.id === 'back_radiation')).toBe(true)
    expect(questionQueue(s, makeUi('mr-IN'))[0].label).toMatch(/[\u0900-\u097f]/)
  })
})
