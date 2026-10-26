import { useLocaleText } from './LocaleProvider'
import { useEffect, useRef, useState } from 'react'
import { trimImage } from '../lib/ocr'
import { useVoice } from './Voice'

/** Camera scanner / image trimmer. With `initial` it skips the camera and shows the preview + trim controls. */
export default function Camera({ initial, onUse, onClose }: { initial?: string; onUse: (dataUrl: string) => void; onClose: () => void }) {
  const _t = useLocaleText();
  const { ui } = useVoice()
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [shot, setShot] = useState(initial ?? '')
  const [err, setErr] = useState('')
  const [m, setM] = useState({ top: 0, right: 0, bottom: 0, left: 0 })
  useEffect(() => {
    if (initial) return
    let dead = false
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((st) => { if (dead) { st.getTracks().forEach((t) => t.stop()); return } stream.current = st; if (video.current) { video.current.srcObject = st; void video.current.play() } })
      .catch(() => setErr(ui('camErr')))
    if (!navigator.mediaDevices?.getUserMedia) setErr(ui('camErr'))
    return () => { dead = true; stream.current?.getTracks().forEach((t) => t.stop()) }
  }, [initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const capture = () => {
    const v = video.current; if (!v || !v.videoWidth) return
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0); setShot(c.toDataURL('image/jpeg', 0.9)); stream.current?.getTracks().forEach((t) => t.stop())
  }
  const retake = () => { setShot(''); setM({ top: 0, right: 0, bottom: 0, left: 0 }); if (initial) { onClose(); return }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }).then((st) => { stream.current = st; if (video.current) { video.current.srcObject = st; void video.current.play() } }).catch(() => setErr(ui('camErr'))) }
  const use = async () => onUse(await trimImage(shot, m))
  const sl = (k: keyof typeof m) => (
    <label className="trim">{ui('trim')} · {k}<input type="range" min={0} max={40} value={m[k]} onChange={(e) => setM({ ...m, [k]: Number(e.target.value) })} /></label>
  )
  return (
    <div className="modal-back" role="dialog" aria-modal="true">
      <div className="modal wide">
        {err ? <p className="form-error">{err}</p> : !shot ? <video ref={video} className="cam" playsInline muted aria-label={_t("camera")} /> : (
          <div className="shot"><img src={shot} alt="" style={{ clipPath: `inset(${m.top}% ${m.right}% ${m.bottom}% ${m.left}%)` }} /></div>
        )}
        {shot && <div className="trims">{sl('top')}{sl('bottom')}{sl('left')}{sl('right')}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>{ui('cancel')}</button>
          {!shot && !err && <button className="btn dark" onClick={capture}>📷 {ui('capture')}</button>}
          {shot && <button className="btn" onClick={retake}>{ui('retake')}</button>}
          {shot && <button className="btn dark" onClick={() => void use()}>{ui('saveDoc')}</button>}
        </div>
      </div>
    </div>
  )
}
