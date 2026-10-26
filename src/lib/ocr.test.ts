import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createWorker, getDocument } = vi.hoisted(() => ({ createWorker: vi.fn(), getDocument: vi.fn() }))
vi.mock('tesseract.js', () => ({ createWorker }))
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument }))

import { ocrLangs, readImage, readPdf } from './ocr'

const worker = (text = 'printed report text') => ({
  recognize: vi.fn().mockResolvedValue({ data: { text, confidence: 88 } }),
  terminate: vi.fn().mockResolvedValue(undefined),
})

beforeEach(() => { createWorker.mockReset(); getDocument.mockReset() })

describe('offline OCR language recovery', () => {
  it('uses the bundled worker, core and local language data for Hindi and Marathi', async () => {
    const engine = worker()
    createWorker.mockResolvedValue(engine)
    const result = await readImage('data:image/png;base64,AA==', 'mr-IN', () => undefined)
    expect(ocrLangs('mr-IN').codes).toBe('eng+mar+hin')
    expect(createWorker).toHaveBeenCalledWith('eng+mar+hin', 1, expect.objectContaining({
      workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr/lang', gzip: true,
    }))
    expect(result.text).toBe('printed report text')
    expect(result.fallback).toBeUndefined()
    expect(engine.terminate).toHaveBeenCalledOnce()
  })

  it('falls back to bundled English when the selected language download fails', async () => {
    const engine = worker('correctable English text')
    createWorker.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce(engine)
    const result = await readImage('data:image/png;base64,AA==', 'bn-IN', () => undefined)
    expect(createWorker).toHaveBeenNthCalledWith(1, 'eng+ben', 1, expect.objectContaining({
      workerPath: '/ocr/worker.min.js', corePath: '/ocr/core',
    }))
    expect(createWorker).toHaveBeenNthCalledWith(2, 'eng', 1, expect.objectContaining({ langPath: '/ocr/lang' }))
    expect(result).toMatchObject({ text: 'correctable English text', langs: 'eng', fallback: true })
  })

  it('preserves the fallback warning for scanned PDF pages', async () => {
    const engine = worker('PDF scan text')
    createWorker.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce(engine)
    const page = { getTextContent: vi.fn().mockResolvedValue({ items: [] }), getViewport: () => ({ width: 160, height: 80 }), render: () => ({ promise: Promise.resolve() }) }
    getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: vi.fn().mockResolvedValue(page) }) })
    vi.spyOn(document, 'createElement').mockReturnValue({ width: 0, height: 0, getContext: () => ({}) } as unknown as HTMLCanvasElement)
    const file = { name: 'fictional-report.pdf', type: 'application/pdf', arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File
    const result = await readPdf(file, 'bn-IN', () => undefined)
    expect(result).toMatchObject({ text: 'PDF scan text', langs: 'eng', fallback: true })
  })

  it('returns an actionable error if the preferred pack and local fallback both fail', async () => {
    createWorker.mockRejectedValueOnce(new Error('Failed to fetch')).mockRejectedValueOnce(new Error('Failed to fetch'))
    let thrown: unknown
    try { await readImage('data:image/png;base64,AA==', 'bn-IN', () => undefined) } catch (error) { thrown = error }
    expect(createWorker).toHaveBeenCalledTimes(2)
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toMatch(/bundled English fallback could not start/)
  })
})
