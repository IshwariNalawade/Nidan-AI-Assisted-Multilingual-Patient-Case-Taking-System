import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { languages } from '../data/languages'
import { isRtl, translateUiText, uiTier } from '../i18n'

const STORAGE_KEY = 'nidan-ui-language'

type LocaleValue = {
  language: string
  setLanguage: (language: string) => void
  locked: boolean
}

const defaultLocale: LocaleValue = { language: 'en-IN', setLanguage: () => undefined, locked: false }
const LocaleContext = createContext<LocaleValue>(defaultLocale)

const supportedLanguage = (value: string) => languages.some((language) => language.code === value) ? value : 'en-IN'
function storedLanguage() {
  try { return supportedLanguage(localStorage.getItem(STORAGE_KEY) ?? 'en-IN') } catch { return 'en-IN' }
}

/** The root provider remembers portal/local-console language on this device only. */
export function LocaleProvider({ children, language: forcedLanguage }: { children: ReactNode; language?: string }) {
  const [savedLanguage, setSavedLanguage] = useState(storedLanguage)
  const language = forcedLanguage ? supportedLanguage(forcedLanguage) : savedLanguage
  const setLanguage = useCallback((value: string) => {
    if (forcedLanguage) return
    const next = supportedLanguage(value)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* private browsing can block storage */ }
    setSavedLanguage(next)
  }, [forcedLanguage])
  const value = useMemo(() => ({ language, setLanguage, locked: Boolean(forcedLanguage) }), [language, setLanguage, forcedLanguage])
  return <LocaleContext.Provider value={value}><div className="locale-root" lang={language} dir={isRtl(language) ? 'rtl' : 'ltr'}>{children}</div></LocaleContext.Provider>
}

export const useLocale = () => useContext(LocaleContext)

export function useLocaleText(languageOverride?: string) {
  const { language } = useLocale()
  const code = languageOverride ?? language
  return useCallback((source: string, vars?: Record<string, string | number>) => translateUiText(code, source, vars), [code])
}

export function LocaleSelector() {
  const { language, setLanguage, locked } = useLocale()
  const t = useLocaleText()
  return <label className="locale-picker"><span className="sr-only">{t('Choose interface language')}</span><select aria-label={t('Choose interface language')} value={language} disabled={locked} onChange={(event) => setLanguage(event.target.value)}>{languages.map((item) => <option key={item.code} value={item.code} lang={item.code.split('-')[0]}>{item.nativeName} — {item.name}</option>)}</select>{uiTier(language) === 'draft' && <small className="locale-review-tag">{t('Draft translation — native-speaker and clinician review required')}</small>}</label>
}

export function PrototypeNotice() {
  const t = useLocaleText()
  return <aside className="prototype-warning portal-prototype-warning" role="note" aria-label={t('DEMO PROTOTYPE — FICTIONAL DATA ONLY')}><strong>{t('DEMO PROTOTYPE — FICTIONAL DATA ONLY')}</strong><p>{t('Do not enter real patient, health, Aadhaar, ABHA, or report information. This site is not production-ready or clinically validated.')}</p><p>{t('Removing a report record from NIDAN does not physically erase the stored demo file.')}</p></aside>
}
