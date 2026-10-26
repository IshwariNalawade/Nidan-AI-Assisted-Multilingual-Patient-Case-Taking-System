import { env } from './config.js'

type TaskType = 'asr' | 'tts'
type LanguageConfig = { sourceLanguage?: string; targetLanguage?: string }
type PipelineConfigEntry = { taskType?: string; config?: Array<{ serviceId?: string; language?: LanguageConfig; gender?: string }> }
type PipelineResponseConfig = { pipelineResponseConfig?: PipelineConfigEntry[]; pipelineInferenceAPIEndPoint?: { callbackUrl?: string; inferenceApiKey?: { name?: string; value?: string } } }
type PipelineOutput = { source?: unknown; target?: unknown }
type ComputeResponse = { pipelineResponse?: Array<{ output?: PipelineOutput[]; audio?: Array<{ audioContent?: unknown }> }> }

const iso = /^[a-z]{2,3}$/
let cached: { expiresAt: number; data: PipelineResponseConfig } | null = null

export const bhashiniLanguage = (language: string) => language.trim().toLowerCase().split('-')[0]

function assertEnabled() {
  if (!env.BHASHINI_ENABLED || !env.BHASHINI_USER_ID || !env.BHASHINI_API_KEY) throw new Error('Bhashini is not configured.')
}

async function pipelineConfig(tasks: TaskType[]): Promise<PipelineResponseConfig> {
  assertEnabled()
  const userId = env.BHASHINI_USER_ID
  const apiKey = env.BHASHINI_API_KEY
  if (!userId || !apiKey) throw new Error('Bhashini credentials are missing.')
  if (cached && cached.expiresAt > Date.now()) return cached.data
  const response = await fetch(env.BHASHINI_CONFIG_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', userID: userId, ulcaApiKey: apiKey },
    body: JSON.stringify({ pipelineTasks: tasks.map((taskType) => ({ taskType })), pipelineRequestConfig: { pipelineId: env.BHASHINI_PIPELINE_ID } }),
    signal: AbortSignal.timeout(env.BHASHINI_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Bhashini pipeline configuration failed (${response.status}).`)
  const data = await response.json() as PipelineResponseConfig
  if (!Array.isArray(data.pipelineResponseConfig)) throw new Error('Bhashini returned no pipeline configuration.')
  cached = { expiresAt: Date.now() + 10 * 60 * 1000, data }
  return data
}

function serviceIdFor(config: PipelineResponseConfig, task: TaskType, language: string): string {
  const entry = config.pipelineResponseConfig?.find((item) => item.taskType === task) ?? config.pipelineResponseConfig?.find((item) => Array.isArray(item.config) && item.config.some((candidate) => candidate.language?.sourceLanguage === language))
  const candidate = entry?.config?.find((item) => item.language?.sourceLanguage === language) ?? entry?.config?.[0]
  if (!candidate?.serviceId) throw new Error(`Bhashini has no ${task.toUpperCase()} service for ${language}.`)
  return candidate.serviceId
}

function inferenceDetails(config: PipelineResponseConfig) {
  const endpoint = config.pipelineInferenceAPIEndPoint?.callbackUrl || env.BHASHINI_INFERENCE_URL
  const keyName = config.pipelineInferenceAPIEndPoint?.inferenceApiKey?.name
  const keyValue = config.pipelineInferenceAPIEndPoint?.inferenceApiKey?.value
  if (!endpoint || !keyName || !keyValue) throw new Error('Bhashini inference endpoint credentials are missing.')
  return { endpoint, headers: { [keyName]: keyValue, 'content-type': 'application/json' } }
}

async function compute(body: unknown, config: PipelineResponseConfig) {
  const { endpoint, headers } = inferenceDetails(config)
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(env.BHASHINI_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`Bhashini inference failed (${response.status}).`)
  return await response.json() as ComputeResponse
}

export async function transcribe(audio: Buffer, mimetype: string, language: string) {
  const sourceLanguage = bhashiniLanguage(language)
  if (!iso.test(sourceLanguage)) throw new Error('A valid Bhashini language code is required.')
  const config = await pipelineConfig(['asr'])
  const serviceId = serviceIdFor(config, 'asr', sourceLanguage)
  const audioFormat = mimetype.includes('wav') ? 'wav' : mimetype.includes('flac') ? 'flac' : mimetype.includes('mpeg') || mimetype.includes('mp3') ? 'mp3' : 'webm'
  const result = await compute({
    pipelineTasks: [{ taskType: 'asr', config: { language: { sourceLanguage }, serviceId, audioFormat, samplingRate: env.BHASHINI_SAMPLING_RATE } }],
    inputData: { audio: [{ audioContent: audio.toString('base64') }] },
  }, config)
  const text = result.pipelineResponse?.[0]?.output?.[0]?.source
  if (typeof text !== 'string' || !text.trim()) throw new Error('Bhashini returned an empty transcript.')
  return { text: text.trim().slice(0, 50_000), language: sourceLanguage, method: 'bhashini-asr' as const }
}

export async function synthesize(text: string, language: string, gender: 'male' | 'female' = 'female') {
  const sourceLanguage = bhashiniLanguage(language)
  if (!iso.test(sourceLanguage)) throw new Error('A valid Bhashini language code is required.')
  const config = await pipelineConfig(['tts'])
  const serviceId = serviceIdFor(config, 'tts', sourceLanguage)
  const result = await compute({
    pipelineTasks: [{ taskType: 'tts', config: { language: { sourceLanguage }, serviceId, gender, samplingRate: 8000 } }],
    inputData: { input: [{ source: text.slice(0, 5_000) }] },
  }, config)
  const audioContent = result.pipelineResponse?.[0]?.audio?.[0]?.audioContent
  if (typeof audioContent !== 'string' || !audioContent) throw new Error('Bhashini returned no speech audio.')
  return { audioContent, language: sourceLanguage, mimeType: 'audio/wav', method: 'bhashini-tts' as const }
}

export const resetBhashiniCache = () => { cached = null }
