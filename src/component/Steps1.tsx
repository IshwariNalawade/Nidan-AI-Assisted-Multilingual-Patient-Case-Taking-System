import { useLocaleText } from './LocaleProvider'
import { useEffect, useMemo, useState } from 'react'
import { StepFrame, type StepProps } from './Frame'
import { ChoiceMic, VoiceInput, useVoice } from './Voice'
import { outputVoiceAvailable } from '../lib/voice'
import { languages } from '../data/languages'
import { detectSymptom, symptomModules } from '../data/clinical'
import { symTr, REGIONS, AYUSH_SYSTEMS } from '../data/ui-data'
import { clinicalText, hasUiTranslation, makeUi, uiLangOf, uiProxyOf, uiTier } from '../i18n'
import { STEPS } from '../model'
import { sha256 } from '../lib/vault'
import { log as auditLog } from '../lib/audit'
import type { Choice } from '../lib/parse'
import type { LanguageCode, SymptomKey } from '../types'

const li = (lang: string): number => (uiLangOf(lang) === 'mr' ? 0 : uiLangOf(lang) === 'hi' ? 1 : -1)
const Check = () => { const _t = useLocaleText(); return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>); }

function HeroArt() {
  const _t = useLocaleText();
  return (
    <svg viewBox="0 0 520 640" className="hero-art" role="img" aria-label={_t("Family using a NIDAN kiosk")} preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e6c8" /><stop offset="1" stopColor="#e9c58f" /></linearGradient></defs>
      <rect width="520" height="640" fill="url(#hg)" />
      <path d="M0 520 L520 450 V640 H0Z" fill="#d9a35a" opacity=".35" />
      <rect x="330" y="150" width="150" height="330" rx="18" fill="#e7d3ad" /><rect x="352" y="190" width="108" height="150" rx="10" fill="#f0a64a" transform="rotate(-8 406 265)" />
      <circle cx="210" cy="190" r="30" fill="#7a5a43" /><path d="M165 235h90l20 230h-130z" fill="#2f4b5e" />
      <circle cx="120" cy="270" r="26" fill="#b98c6b" /><path d="M80 305h80l14 190H66z" fill="#efe3c9" /><path d="M96 305 150 470" stroke="#e8933a" strokeWidth="10" />
      <circle cx="285" cy="330" r="22" fill="#6b4a36" /><path d="M255 360h60l12 140h-84z" fill="#f2b441" />
      <rect x="440" y="150" width="8" height="8" rx="2" fill="#f0a64a" />
    </svg>
  )
}

export function Welcome({ nav }: StepProps) {
  const _t = useLocaleText();
  const { ui } = useVoice()
  const tiles = [['01', 't1', 't1d'], ['02', 't2', 't2d'], ['03', 't3', 't3d']]
  return (
    <div className="welcome">
      <nav className="hospital-utility" aria-label={_t("Information links")}><a href="#/about">{_t("Find a care pathway")}</a><a href="#/about">{_t("Research and safety")}</a><a href="#/about">{_t("About NIDAN")}</a><a href="#/about">{_t("Accessibility")}</a><a href="#/account">{_t("Patient / doctor portal")}</a></nav>
      <nav className="hospital-nav" aria-label={_t("NIDAN services")}><a className="hospital-wordmark" href="#/">{_t("NIDAN")}<span>+</span></a><div className="hospital-links"><a href="#/">{_t("Kiosk intake")}</a><a href="#/about">{_t("Care services⌄")}</a><a href="#/about">{_t("Clinical review⌄")}</a><a href="#/about">{_t("Safety and privacy⌄")}</a></div><div className="hospital-location">{_t("⌖ India")}</div></nav>
      <div className="hospital-actions"><button onClick={() => nav.next()}>{_t("☎ Request assistance")}</button><button className="featured-action" onClick={() => nav.next()}>{_t("▣ Start an intake")}</button><button onClick={() => nav.go('language')}>{_t("♧ Choose language")}</button></div>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><i />{ui('eyebrow')}</p>
          <h1 className="hero-title">{_t("Care information")}<br /><strong>{_t("made clearer.")}</strong></h1>
          <p className="hero-body">{ui('welcomeBody')}</p>
          <button className="btn dark xl" onClick={() => nav.next()}><span className="orange-dot">→</span>{ui('startIntake')}<span aria-hidden>→</span></button>
          <p className="micro">🛡 {ui('localDemo')} <span className="sep" /> 🔊 {ui('voiceTouch')}</p>
        </div>
        <div className="hero-media"><HeroArt /><div className="hero-glass"><span className="mono tiny">{_t("PATIENT-FIRST CARE / 01")}</span><b>{_t("Understand your symptoms before your consultation.")}</b><span>{_t("Voice-guided · multilingual · safety-aware")}</span></div><div className="float-card"><div><div className="mono tiny">{_t("NIDAN / 01")}</div><b>{ui('fictionalOnly')}</b></div><span className="qr">▦</span></div></div>
      </section>
      <div className="welcome-search"><span>⌕</span><span>{_t("Search symptoms, care pathways and NIDAN services")}</span><button onClick={() => nav.next()}>{_t("Begin guided intake →")}</button></div>
      <div className="tiles">{tiles.map(([n, a, b]) => <div className="tile" key={n}><div className="mono tiny">{n}</div><h3>{ui(a)}</h3><p>{ui(b)}</p><span className="tile-arrow">↗</span></div>)}</div>
    </div>
  )
}

export function Language({ s, set, nav }: StepProps) {
  const _t = useLocaleText();
  const v = useVoice(), { ui } = v
  const [, refreshVoices] = useState(0)
  useEffect(() => {
    const synthesis = window.speechSynthesis
    if (!synthesis) return
    const refresh = () => refreshVoices((n) => n + 1)
    refresh()
    synthesis.addEventListener?.('voiceschanged', refresh)
    return () => synthesis.removeEventListener?.('voiceschanged', refresh)
  }, [])
  const list = useMemo(() => [languages.find((l) => l.code === 'en-IN')!, ...languages.filter((l) => l.code !== 'en-IN').sort((a, b) => a.name.localeCompare(b.name))], [])
  const choices: Choice[] = list.map((l) => ({ value: l.code, words: [l.name.toLowerCase(), ...l.nativeName.split('/').map((x) => x.trim().toLowerCase())] }))
  const pick = (code: LanguageCode) => set({ lang: code })
  return (
    <StepFrame s={s} step="language" title={ui('langTitle')} desc={ui('langDesc')} prompt={ui('langDesc')} nav={nav}>
      <div className="mic-line"><ChoiceMic choices={choices} onPick={(c) => pick(c as LanguageCode)} onMatched={() => window.setTimeout(nav.next, 250)} label={(c) => list.find((l) => l.code === c)?.name ?? c} primary /></div>
      <div className="lang-grid" role="radiogroup" aria-label={ui('langTitle')}>
        {list.map((l) => {
          const on = s.lang === l.code
          return (
            <button key={l.code} role="radio" aria-checked={on} className={'card-opt' + (on ? ' on' : '')} lang={l.code.split('-')[0]} onClick={() => pick(l.code)}>
              <span className="script-badge">{l.code === 'en-IN' ? _t("EN") : [...l.nativeName][0]}</span>
              {on && <span className="tick"><Check /></span>}
              <span className="opt-title">{l.nativeName}</span>
              <span className="opt-sub">{l.name}</span>
              <span className="opt-sub voice-instruction">{_t("🎤 Tap the mic, wait for “Listening…”, speak clearly in")}{" "}{l.name}{_t(", then review and confirm.")}</span>
              <span className={'chip-tag' + (uiTier(l.code) === 'full' ? ' ok' : uiTier(l.code) === 'draft' ? ' warn' : '')}>{uiTier(l.code) === 'full' ? ui('tr_reviewed') : uiTier(l.code) === 'draft' ? ui('tr_draft') : ui('tr_other')}</span>
              <span className="chip-tag">{voiceHere(l.voiceTag) ? '🔊 ' + ui('voiceInstalled') : ui('voiceMissingChip')}</span>
            </button>
          )
        })}
      </div>
      {!hasUiTranslation(s.lang) && <p className="note-box warn">{ui('langFallback')}</p>}
      {uiTier(s.lang) === 'draft' && <p className="note-box warn">{ui('draftTr')}</p>}
      {uiProxyOf(s.lang) && <p className="note-box warn">{ui('proxyTr')}</p>}
    </StepFrame>
  )
}

const voiceHere = (tag: string) => outputVoiceAvailable(tag)
const SEX = ['male', 'female', 'pns'] as const
export function Patient({ s, set, nav }: StepProps) {
  const _t = useLocaleText();
  const v = useVoice(), { ui } = v
  const [touched, setTouched] = useState(false)
  const p = s.profile, months = p.ageUnit === 'months', nAge = Number(p.age)
  const upd = (patch: Partial<typeof p>) => set({ profile: { ...p, ...patch } })
  const showPreg = p.sex === 'female' && !months && p.age !== '' && nAge >= 12 && nAge <= 55
  const errs = {
    name: p.name.trim().length < 2 ? ui('errName') : '',
    age: !/^\d{1,3}$/.test(p.age) || (months ? nAge > 35 : nAge > 120) ? ui(months ? 'errAgeM' : 'errAge') : '',
    phone: p.phone && !/^\d{10}$/.test(p.phone.replace(/\s/g, '')) ? ui('errPhone') : '',
    type: !p.type ? ui('needPick') : '', sex: !p.sex ? ui('needPick') : '',
    rel: p.forWho !== 'self' && p.relation.trim().length < 2 ? ui('errRel') : '', preg: showPreg && !p.pregnant ? ui('needPick') : '',
  }
  const next = (t: string) => { if (v.autoSpeak) v.speakText(t) }
  return (
    <StepFrame s={s} step="patient" title={ui('patientTitle')} desc={ui('patientDesc')} prompt={ui('v_ptype')} nav={nav}
      validate={() => { setTouched(true); return errs.type || errs.rel || errs.name || errs.age || errs.sex || errs.preg || errs.phone || null }}>
      <div className="two-cards" role="radiogroup">
        {([['new', 'newP', 'newPd'], ['returning', 'retP', 'retPd']] as const).map(([k, a, b]) => (
          <button key={k} role="radio" aria-checked={p.type === k} className={'card-opt big' + (p.type === k ? ' on' : '')} onClick={() => upd({ type: k })}>
            <span className="icon-circle lg">{k === 'new' ? '👤' : '▦'}</span>{p.type === k && <span className="tick"><Check /></span>}
            <span className="opt-title">{ui(a)}</span><span className="opt-sub">{ui(b)}</span>
          </button>
        ))}
      </div>
      <div className="mic-line"><ChoiceMic choices={[{ value: 'new', words: ['new', 'नवीन', 'नया', 'नई', 'first'] }, { value: 'returning', words: ['returning', 'return', 'old', 'परत', 'वापस', 'पुन्हा', 'जुना', 'पुराना'] }]} onPick={(x) => upd({ type: x as 'new' | 'returning' })} label={(x) => ui(x === 'new' ? 'newP' : 'retP')} /></div>
      <fieldset className="who"><legend>{ui('forWho')}</legend>
        <div className="chip-row">{(['self', 'child', 'other'] as const).map((k) => <button key={k} className={'chip' + (p.forWho === k ? ' on' : '')} aria-pressed={p.forWho === k} onClick={() => upd({ forWho: k, ...(k === 'self' ? { relation: '' } : {}) })}>{ui(k === 'self' ? 'forSelf' : k === 'child' ? 'forChild' : 'forOther')}</button>)}</div>
        {p.forWho !== 'self' && <><p className="note-box warm">{ui('proxyNote')}</p><VoiceInput id="f-rel" label={ui('relation')} prompt={ui('relation')} value={p.relation} onChange={(x) => upd({ relation: x })} invalid={touched ? errs.rel : ''} /></>}
      </fieldset>
      <div className="form-grid">
        <VoiceInput id="f-name" label={ui('fullName')} prompt={ui('v_name')} value={p.name} onChange={(x) => upd({ name: x })} onConfirm={() => next(ui('v_age'))} autoPrimary invalid={touched ? errs.name : ''} />
        <div className="vfield">
          <VoiceInput id="f-age" label={ui('age')} prompt={ui('v_age')} value={p.age} kind="age" inputMode="numeric" onChange={(x) => upd({ age: x.replace(/\D/g, '').slice(0, 3) })} onConfirm={() => next(ui('v_sex'))} invalid={touched ? errs.age : ''} />
          <div className="chip-row">{(['years', 'months'] as const).map((u) => <button key={u} className={'chip' + (p.ageUnit === u ? ' on' : '')} aria-pressed={p.ageUnit === u} onClick={() => upd({ ageUnit: u })}>{ui(u === 'years' ? 'unitY' : 'unitM')}</button>)}</div>
        </div>
        <div className="vfield">
          <div className="vlabel"><label>{ui('sex')}</label><button type="button" className="icon-btn" onClick={() => v.speakText(ui('v_sex'))} aria-label={ui('replay')}>🔊</button></div>
          <div className="chip-row">{SEX.map((k) => <button key={k} className={'chip' + (p.sex === k ? ' on' : '')} aria-pressed={p.sex === k} onClick={() => upd({ sex: k, ...(k !== 'female' ? { pregnant: '' as const } : {}) })}>{ui(k)}</button>)}</div>
          <ChoiceMic choices={[{ value: 'male', words: ['male', 'man', 'boy', 'पुरुष', 'पुरूष', 'आदमी', 'मुलगा'] }, { value: 'female', words: ['female', 'woman', 'girl', 'महिला', 'स्त्री', 'बाई', 'औरत', 'मुलगी'] }, { value: 'pns', words: ['prefer', 'skip', 'सांगू', 'बताना'] }]} onPick={(x) => { upd({ sex: x as typeof p.sex }); next(ui('v_phone')) }} label={(x) => ui(x)} />
          {touched && errs.sex && <p className="status err">{errs.sex}</p>}
        </div>
        <VoiceInput id="f-phone" label={ui('phone')} prompt={ui('v_phone')} value={p.phone} kind="phone" inputMode="numeric" onChange={(x) => upd({ phone: x.replace(/[^\d ]/g, '').slice(0, 11) })} invalid={touched ? errs.phone : ''} />
      </div>
      {showPreg && <fieldset className="who"><legend>{ui('pregQ')}</legend><div className="chip-row">{(['yes', 'no', 'unsure'] as const).map((k) => <button key={k} className={'chip' + (p.pregnant === k ? ' on' : '')} aria-pressed={p.pregnant === k} onClick={() => upd({ pregnant: k })}>{ui(k === 'unsure' ? 'o_unsure' : k)}</button>)}</div>{touched && errs.preg && <p className="status err">{errs.preg}</p>}</fieldset>}
      <div className="chip-row"><label className="toggle"><input type="checkbox" checked={s.assisted} onChange={(e) => set({ assisted: e.target.checked })} /> {ui('staffHelp')}</label><label className="toggle"><input type="checkbox" checked={s.express} onChange={(e) => set({ express: e.target.checked })} /> {ui('express')}</label></div>
      <div className="dashed-box"><span className="icon-circle">▦</span><span>{ui('demoId')}: <b className="mono-b">{_t("NIDAN-DEMO-")}{String(s.id.slice(-3)).padStart(3, '0')}</b></span><span className="chip-tag ok">{ui('demoIdReady')}</span></div>
    </StepFrame>
  )
}

export function Register({ s, set, nav }: StepProps) {
  const _t = useLocaleText();
  const v = useVoice(), { ui } = v
  const p = s.profile
  const [abhaErr, setAbhaErr] = useState('')
  const looksReal = (x: string) => /^\d{2}-?\d{4}-?\d{4}-?\d{4}$/.test(x.trim()) || /^\d{4}\s?\d{4}\s?\d{4}$/.test(x.trim())
  const demo = `ABHA-DEMO-DEMO-${s.id.slice(-3).padStart(3, '0')}`
  return (
    <StepFrame s={s} step="register" title={ui('regTitle')} desc={ui('regDesc')} prompt={ui('regDesc')} nav={nav} nextLabel={ui('saveReg')}
      validate={() => { if (p.abha && looksReal(p.abha)) { const m = ui('demoOnly'); setAbhaErr(m); return m } if (p.name.trim().length < 2) return ui('errName'); setAbhaErr(''); return null }}>
      <div className="split">
        <section className="panel">
          <div className="panel-head"><span className="icon-circle lg warm">✔</span><div><div className="mono tiny orange">{ui('demoAbha').toUpperCase()}</div><h2>{ui('regTitle')}</h2><p className="desc small">{ui('regDesc')}</p></div></div>
          <VoiceInput id="r-name" label={ui('fullName')} prompt={ui('v_name')} value={p.name} onChange={(x) => set({ profile: { ...p, name: x } })} autoPrimary />
          <div className="vfield"><div className="vlabel"><label htmlFor="r-abha" className="mono tiny">{_t("ABHA ID")}</label></div>
            <div className="abha-row">
              <input id="r-abha" className="input mono-b" value={p.abha} maxLength={32} onChange={(e) => { set({ profile: { ...p, abha: e.target.value } }); setAbhaErr('') }} aria-invalid={Boolean(abhaErr)} />
              <button className="btn warm" onClick={() => set({ profile: { ...p, abha: demo } })}>{ui('demoAbha')}</button>
              <button className="btn" onClick={() => set({ profile: { ...p, abha: demo, name: p.name || 'Anjali Patil' } })}>▦ {ui('demoQr')}</button>
            </div>
            <p className="status">{ui('demoOnly')}</p>{abhaErr && <p className="status err" role="alert">{abhaErr}</p>}
          </div>
        </section>
        <aside className="panel soft">
          <div className="panel-head"><span className="icon-circle lg green">🔒</span><div><h3>{ui('regOptional')}</h3><p className="desc small">{ui('fictionalOnly')}</p></div></div>
          <div className="mono tiny rule">{ui('regPreview')}</div>
          <dl className="kv"><dt>{ui('fullName')}</dt><dd>{p.name || '—'}</dd><dt>{_t("ABHA ID")}</dt><dd className="mono-b orange">{p.abha || '—'}</dd></dl>
          <div className="note-box ok"><b>{ui('fictionalId')}</b><p>{ui('fictionalIdD')}</p></div>
        </aside>
      </div>
    </StepFrame>
  )
}

export function Consent({ s, set, nav }: StepProps) {
  const _t = useLocaleText();
  const { ui, lang } = useVoice()
  const items = ['c1', 'c2', 'c3', 'c4']
  const a = Number(s.profile.age), minor = s.profile.forWho !== 'self' || (s.profile.age !== '' && (s.profile.ageUnit === 'months' || a < 18))
  const log = () => { const text = `${items.map((k) => ui(k)).join('\n')}\nAI processing opt-in: ${s.aiProcessing ? 'yes' : 'no'}`; void sha256(text).then((h) => set({ consentLog: { at: new Date().toISOString(), version: 'consent-2026-10-v1', lang, by: minor ? 'guardian' : 'self', textHash: h, voice: s.voiceOptIn, research: s.research, aiProcessing: s.aiProcessing } })); void auditLog('kiosk', 'consent_given', s.id); void auditLog('kiosk', s.aiProcessing ? 'ai_processing_consent_given' : 'ai_processing_consent_not_given', s.id) }
  return (
    <StepFrame s={s} step="consent" title={ui('consentTitle')} desc={ui('consentDesc')} prompt={`${ui('consentDesc')} ${items.map((k) => ui(k)).join(' ')}`} nav={nav}
      validate={() => (!s.consent ? ui('needConsent') : minor && !s.guardian ? ui('needGuardian') : null)} onNext={() => { log() }}>
      <ul className="consent-list">{items.map((k) => <li key={k}><span className="icon-circle">✓</span>{ui(k)}</li>)}</ul>
      {minor && <label className="consent-check"><input type="checkbox" checked={s.guardian} onChange={(e) => set({ guardian: e.target.checked })} /><span>{ui('guardian')}</span></label>}
      <label className="consent-check"><input type="checkbox" checked={s.consent} onChange={(e) => set({ consent: e.target.checked })} /><span>{ui('agree')}</span></label>
      <label className="toggle research"><input type="checkbox" checked={s.research} onChange={(e) => set({ research: e.target.checked })} /> <span>{ui('researchOpt')}</span></label>
      <label className="toggle ai-processing"><input type="checkbox" checked={s.aiProcessing === true} onChange={(e) => set({ aiProcessing: e.target.checked })} /> <span>{ui('aiProcessOpt')}</span></label>
      <p className="status">{ui('aiProcessDesc')}</p>
    </StepFrame>
  )
}

export function Consultation({ s, set, nav }: StepProps) {
  const _t = useLocaleText();
  const { ui } = useVoice()
  const opts = [['general', 'general', 'generalD', '🩺'], ['ayush', 'ayushC', 'ayushD', '🌿']] as const
  return (
    <StepFrame s={s} step="consultation" title={ui('consTitle')} desc={ui('consDesc')} prompt={ui('v_cons')} nav={nav} validate={() => (s.consultation ? null : ui('needPick'))}>
      <div className="two-cards" role="radiogroup">
        {opts.map(([k, a, b, ic]) => (
          <button key={k} role="radio" aria-checked={s.consultation === k} className={'card-opt big' + (s.consultation === k ? ' on' : '')} onClick={() => set({ consultation: k })}>
            <span className="icon-circle lg">{ic}</span>{s.consultation === k && <span className="tick"><Check /></span>}
            <span className="opt-title">{ui(a)}</span><span className="opt-sub">{ui(b)}</span>
          </button>
        ))}
      </div>
      <div className="mic-line"><ChoiceMic primary choices={[{ value: 'general', words: ['general', 'standard', 'regular', 'सामान्य', 'जनरल'] }, { value: 'ayush', words: ['ayush', 'ayurveda', 'आयुष', 'आयुर्वेद'] }]} onPick={(x) => set({ consultation: x as 'general' | 'ayush' })} onMatched={() => window.setTimeout(nav.next, 250)} label={(x) => ui(x === 'general' ? 'general' : 'ayushC')} /></div>
      <p className="note-box">🛡 {ui('consNote')}</p>
    </StepFrame>
  )
}

export function AyushSys({ s, set, nav }: StepProps) {
  const _t = useLocaleText();
  const { ui, lang } = useVoice(), i = li(lang)
  const systemText = (id: string, english: string, translated: string) => clinicalText(lang, `ayush:${id}`, i >= 0 ? translated : english)
  return (
    <StepFrame s={s} step="ayushSys" title={ui('ayushSysTitle')} desc={ui('ayushSysDesc')} prompt={ui('ayushSysDesc')} nav={nav} validate={() => (s.ayushSystem ? null : ui('needPick'))}>
      <div className="mic-line"><ChoiceMic primary choices={AYUSH_SYSTEMS.map((a) => ({ value: a.id, words: [...a.words, systemText(a.id, a.en, a.tr[i] ?? a.en).toLowerCase()] }))} onPick={(x) => set({ ayushSystem: x })} onMatched={() => window.setTimeout(nav.next, 250)} label={(x) => { const a = AYUSH_SYSTEMS.find((item) => item.id === x); return a ? systemText(a.id, a.en, a.tr[i] ?? a.en) : x }} /></div>
      <div className="lang-grid">{AYUSH_SYSTEMS.map((a) => (
        <button key={a.id} className={'card-opt' + (s.ayushSystem === a.id ? ' on' : '')} aria-pressed={s.ayushSystem === a.id} onClick={() => set({ ayushSystem: a.id })}>
          <span className="script-badge">🌿</span>{s.ayushSystem === a.id && <span className="tick"><Check /></span>}<span className="opt-title">{systemText(a.id, a.en, a.tr[i] ?? a.en)}</span>
        </button>))}</div>
    </StepFrame>
  )
}

export function Concern({ s, set, nav }: StepProps) {
  const _t = useLocaleText();
  const { ui, lang } = useVoice(), i = li(lang)
  const guess = useMemo(() => detectSymptom(s.concern), [s.concern])
  const ret = s.profile.type === 'returning'
  const FEEL = [['Better', 'fb'], ['About the same', 'fs'], ['Worse', 'fw'], ['A new problem', 'fn']] as const
  const setFeel = (v: string) => set((c) => ({ answers: { ...c.answers, feeling_now: v } }))
  const label = (k: SymptomKey, en: string) => clinicalText(lang, `symptom:${k}:label`, i >= 0 ? symTr[k][i] : en)
  const description = (key: SymptomKey, english: string) => clinicalText(lang, `symptom:${key}:description`, english)
  const choices: Choice[] = symptomModules.map((m) => ({ value: m.key, words: [...m.keywords.map((w) => w.toLowerCase()), ...symTr[m.key].flatMap((x) => x.toLowerCase().split(/[\s/]+/).filter(Boolean)), label(m.key, m.label).toLowerCase()] }))
  return (
    <StepFrame s={s} step="concern" title={ui(ret ? 'feelNow' : 'concernTitle')} desc={ui(ret ? 'feelDesc' : 'concernDesc')} prompt={ui(ret ? 'feelNow' : 'v_concern')} nav={nav} validate={() => ((ret ? s.answers.feeling_now : s.concern.trim() || s.symptom) ? null : ui('needPick'))}>
      {ret && <><div className="chip-row" role="radiogroup" aria-label={ui('feelNow')}>{FEEL.map(([v, k]) => <button key={v} role="radio" aria-checked={s.answers.feeling_now === v} className={'chip big' + (s.answers.feeling_now === v ? ' on' : '')} onClick={() => setFeel(v)}>{ui(k)}</button>)}</div>
        <ChoiceMic primary choices={FEEL.map(([v, k]) => ({ value: v, words: [...new Set([makeUi('en-IN')(k), makeUi('mr-IN')(k), makeUi('hi-IN')(k)].map((x) => x.toLowerCase()))] }))} onPick={setFeel} label={(v) => ui(FEEL.find((f) => f[0] === v)?.[1] ?? v)} /></>}
      <VoiceInput id="concern" label={ui(ret ? 'tellMore' : 'concernLabel')} prompt={ui('v_concern')} value={s.concern} multiline rows={3} onChange={(x) => set({ concern: x })} autoPrimary={!ret} placeholder={ui('ph')} />
      {guess && (
        <div className="note-box warm"><span>{ui('matched')} <b>{label(guess, symptomModules.find((m) => m.key === guess)!.label)}</b></span> <button className="btn small dark" onClick={() => set({ symptom: guess })}>✓ {ui('correct')}</button></div>
      )}
      <div className="section-row"><h3>{ui('pickCard')}</h3><ChoiceMic choices={choices} onPick={(x) => set({ symptom: x as SymptomKey })} label={(x) => label(x as SymptomKey, x)} /></div>
      <div className="symptom-grid">{symptomModules.map((m) => (
        <button key={m.key} className={'card-opt' + (s.symptom === m.key ? ' on' : '')} aria-pressed={s.symptom === m.key} onClick={() => set({ symptom: s.symptom === m.key ? '' : m.key, answers: s.symptom === m.key ? s.answers : {}, qi: 0 })}>
          <span className="script-badge">{m.icon}</span>{s.symptom === m.key && <span className="tick"><Check /></span>}
          <span className="opt-title">{label(m.key, m.label)}</span><span className="opt-sub">{description(m.key, m.description)}</span>
        </button>))}</div>
    </StepFrame>
  )
}

export function Body({ s, set, nav }: StepProps) {
  const _t = useLocaleText();
  const { ui, lang } = useVoice(), i = li(lang)
  const toggle = (id: string) => set({ body: s.body.includes(id) ? s.body.filter((x) => x !== id) : [...s.body.filter((x) => x !== 'unsure'), id] })
  const name = (r: (typeof REGIONS)[number]) => clinicalText(lang, `region:${r.id}`, i >= 0 ? r.tr[i] : r.en)
  return (
    <StepFrame s={s} step="body" title={ui('bodyTitle')} desc={ui('bodyDesc')} prompt={ui('v_body')} nav={nav} validate={() => (s.body.length ? null : ui('needPick'))}>
      <div className="mic-line"><ChoiceMic primary choices={[...REGIONS.map((r) => ({ value: r.id, words: [...r.words, name(r).toLowerCase()] })), { value: 'unsure', words: ['unsure', 'not sure', 'माहिती नाही', 'पता नहीं'] }]} onPick={(x) => (x === 'unsure' ? set({ body: ['unsure'] }) : toggle(x))} label={(x) => (x === 'unsure' ? ui('notSure') : name(REGIONS.find((r) => r.id === x)!))} /></div>
      <div className="split body">
        <div className="panel fig">
          <div className="mono tiny center">{ui('bodyFront')}</div>
          <svg viewBox="0 0 200 310" className="figure" aria-label={ui('bodyFront')}>
            <circle cx="100" cy="28" r="20" className="fb" /><rect x="86" y="46" width="28" height="16" className="fb" />
            <path d="M70 66h60l8 90-12 50h-52l-12-50z" className="fb" /><path d="M66 74 46 150M134 74l20 76" className="fl" /><path d="M84 206l-6 90M116 206l6 90" className="fl" />
            {REGIONS.map((r) => (
              <g key={r.id} role="button" tabIndex={0} aria-label={name(r)} aria-pressed={s.body.includes(r.id)} className={'dot' + (s.body.includes(r.id) ? ' on' : '')} onClick={() => toggle(r.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(r.id) } }}>
                <circle cx={r.x} cy={r.y} r="9" /><circle cx={r.x} cy={r.y} r="3" className="c" />
              </g>))}
          </svg>
        </div>
        <div className="region-grid">
          {REGIONS.map((r) => <button key={r.id} className={'card-opt slim' + (s.body.includes(r.id) ? ' on' : '')} aria-pressed={s.body.includes(r.id)} onClick={() => toggle(r.id)}><span className="opt-title sm">{name(r)}</span><span className="opt-sub">{ui('tapHurt')}</span></button>)}
          <button className={'card-opt slim' + (s.body.includes('unsure') ? ' on' : '')} aria-pressed={s.body.includes('unsure')} onClick={() => set({ body: ['unsure'] })}><span className="opt-title sm">{ui('notSure')}</span></button>
        </div>
      </div>
    </StepFrame>
  )
}
export { STEPS }
