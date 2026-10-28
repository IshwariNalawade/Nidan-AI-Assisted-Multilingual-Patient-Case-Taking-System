import { useEffect, useState } from 'react'
import { useLocale, useLocaleText } from './LocaleProvider'
import { languageByCode } from '../data/languages'
import { outputVoiceAvailable, speak, stopSpeaking, usingProxyVoice } from '../lib/voice'

/** Site-wide "read this page aloud" control. Uses the selected interface language for every one of the 23 languages (closest installed voice when the exact one is missing). */
export default function PageVoice() {
  const t = useLocaleText()
  const { language } = useLocale()
  const [on, setOn] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => { stopSpeaking(); setOn(false) }, [language])
  useEffect(() => () => stopSpeaking(), [])
  const toggle = () => {
    if (on) { stopSpeaking(); setOn(false); return }
    const root = document.querySelector('.ws-content, main, .app') as HTMLElement | null
    const text = (root?.innerText ?? document.body.innerText).replace(/\s+/g, ' ').trim().slice(0, 2500)
    if (!text) return
    setNote(outputVoiceAvailable(language) ? (usingProxyVoice(language) ? t('Using the closest installed voice for this language.') : '') : t('No installed speech voice for this language on this device; text stays available.'))
    setOn(true)
    speak(text, /[^\x00-\x7f]/.test(text) ? languageByCode(language).voiceTag : 'en-IN', false, () => setNote(t('No installed speech voice for this language on this device; text stays available.')), () => setOn(false))
  }
  return <div className="pv-bar" role="group" aria-label={t('Voice')}><button type="button" onClick={toggle} aria-pressed={on}>{on ? '■ ' + t('Stop') : '🔊 ' + t('Read page aloud')}</button>{note && <small role="status">{note}</small>}</div>
}
