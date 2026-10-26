import { useLocaleText } from './LocaleProvider'
import { useEffect, useState, type ReactNode } from 'react'
import { GuideCard, useVoice } from './Voice'
import { STEPS, type Session, type StepKey } from '../model'
import { nativeName } from '../i18n'

export type SetFn = (p: Partial<Session> | ((c: Session) => Partial<Session>)) => void
export interface Nav { next: () => void; back: () => void; go: (s: StepKey) => void }
export interface StepProps { s: Session; set: SetFn; nav: Nav }

export function StepFrame(p: {
  s: Session; step: StepKey; title: string; desc: string; prompt?: string; nav: Nav; children: ReactNode
  validate?: () => string | null; onNext?: () => boolean | void; onBack?: () => boolean | void; nextLabel?: string; hideNext?: boolean; hideBack?: boolean
}) {
  const _t = useLocaleText();
  const v = useVoice(), { ui } = v
  const [err, setErr] = useState('')
  const idx = STEPS.indexOf(p.step) + 1
  const spoken = p.prompt ?? `${p.title}. ${p.desc}`
  useEffect(() => { if (v.autoSpeak && !v.muted) { const t = setTimeout(() => v.speakText(spoken), 350); return () => clearTimeout(t) } }, [p.step, v.lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const next = () => {
    if (v.pending.length) { setErr(ui('confirmFirst')); return }
    const bad = p.validate?.() ?? null
    if (bad) { setErr(bad); return }
    setErr('')
    if (p.onNext?.() === false) return
    p.nav.next()
  }
  const back = () => { setErr(''); if (p.onBack?.() === false) return; p.nav.back() }
  return (
    <article className="page">
      <header className="page-head">
        <div>
          <div className="badges"><span className="badge warm">{String(idx).padStart(2, '0')} / {STEPS.length}</span><span className="badge green">{ui('demo')}</span></div>
          <h1 className="title">{p.title}</h1>
          <p className="desc">{p.desc}</p>
        </div>
        <button className="lang-card" onClick={() => p.nav.go('language')} aria-label={ui('s_language')}>
          <span className="icon-circle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7" /></svg></span>
          <span><span className="mono tiny">{ui('voiceTouch')}</span><b>{nativeName(p.s.lang)}</b></span>
        </button>
      </header>
      <div className="page-body">
        <GuideCard prompt={spoken} />
        {p.children}
        {err && <p className="form-error" role="alert">{err}</p>}
      </div>
      <footer className="page-foot">
        {p.hideBack ? <span /> : <button className="link-btn" onClick={back}>← {ui('back')}</button>}
        {!p.hideNext && <button className="btn dark big" onClick={next}>{p.nextLabel ?? ui('next')} <span aria-hidden>→</span></button>}
      </footer>
    </article>
  )
}
