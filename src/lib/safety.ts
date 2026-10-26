// Red-flag engine v2: concept matching (not bare keywords) + negation + spelling/romanisation tolerance
// + risk context (infant / child / pregnancy / elderly). Every finding carries the evidence text so staff can audit it.
// STATUS: draft lexicon — NOT clinically reviewed. See clinical-review.csv / REVIEW.md.
export type Tier = 'urgent' | 'review'
export interface Finding { id: string; label: string; tier: Tier; evidence: string; note?: string }
export interface Ctx { ageYears: number | null; ageMonths?: number | null; pregnant: 'yes' | 'no' | 'unsure' | ''; severity?: number }
export interface Result { urgent: Finding[]; review: Finding[]; denied: string[] }

const roman = (t: string) => t.replace(/chh/g, 'ch').replace(/ph/g, 'f').replace(/w/g, 'v').replace(/z/g, 'j').replace(/([a-z])\1+/g, '$1')
export function norm(t: string): string {
  const s = t.normalize('NFC').toLowerCase().replace(/[\u200c\u200d']/g, '').replace(/\u0901/g, '\u0902').replace(/\u093c/g, '').replace(/[\u0966-\u096f]/g, (d) => String(d.charCodeAt(0) - 0x966))
  return /[a-z]/.test(s) && !/[^\x00-\x7f]/.test(s) ? roman(s) : s
}
const BREAK = new Set(['but', 'however', 'although', 'lekin', 'magar', 'par', 'pan', 'parantu', 'परंतु', 'लेकिन', 'मगर', 'पर', 'पण'])
const clauses = (text: string): string[][] => text.toLowerCase().split(/[.,;:!?।\n|]+/).map((c) => (c.match(/[\p{L}\p{M}\p{N}']+/gu) ?? []).map(norm)).flatMap((toks) => {
  const out: string[][] = [[]]
  for (const t of toks) { if (BREAK.has(t)) out.push([]); else out[out.length - 1].push(t) }
  return out
}).filter((c) => c.length)
const lev = (a: string, b: string) => { const A = [...a], B = [...b]; let p = Array.from({ length: B.length + 1 }, (_, i) => i); for (let i = 1; i <= A.length; i++) { const c = [i]; for (let j = 1; j <= B.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1)); p = c } return p[B.length] }
const eq = (a: string, b: string) => a === b || ([...a].length >= 5 && [...b].length >= 5 && lev(a, b) <= 1)
const phrase = (s: string) => s.split(/\s+/).map(norm)
const findAt = (toks: string[], alt: string[]) => { const hits: [number, number][] = []; for (let i = 0; i + alt.length <= toks.length; i++) if (alt.every((w, k) => eq(toks[i + k], w))) hits.push([i, i + alt.length - 1]); return hits }

const NEG = new Set(['no', 'not', 'never', 'without', 'denies', 'denied', 'nil', 'none', 'nahi', 'nahin', 'nai', 'nako', 'नहीं', 'नाही', 'नको', 'नही', 'নেই', 'না', 'இல்லை', 'లేదు', 'ಇಲ್ಲ', 'ഇല്ല', 'નથી', 'નહીં'].map(norm))
const UNSURE = new Set(['maybe', 'might', 'sometimes', 'earlier', 'before', 'was', 'tha', 'thi', 'pehle', 'shayad', 'kabhi', 'kadhi', 'purvi', 'होता', 'होती', 'था', 'थी', 'पहले', 'कभी', 'कधी', 'शायद', 'पूर्वी', 'yesterday', 'kal'].map(norm))

type Pat = string[][]            // groups that must all appear within SPAN tokens; each group = alternatives (words or phrases)
export interface Concept { id: string; label: string; tier: Tier; pats: Pat[]; gate?: (c: Ctx) => boolean; note?: string }
const A = (s: string) => s.split('|')
const CHEST = A('chest|seena|seene|sina|sine|seney|chhati|chhatit|chati|छाती|छातीत|छातीमें|सीने|सीना|सीनेमें|ఛాతీ|ఛాతిలో|நெஞ்சு|நெஞ்சில்|ಎದೆ|നെഞ്ച്|നെഞ്ചിൽ|છાતી|છાતીમાં|বুকে|বুক')
const PAIN = A('pain|painful|dard|dukhte|dukhtay|dukhne|dukh|vedna|ache|aching|pressure|tight|tightness|burning|heaviness|दर्द|दुखणे|दुखते|दुखतंय|दुखत|वेदना|जळजळ|जलन|दबाव|जकड़न|भारीपन|வலி|నొప్పి|ವೇದನೆ|ನೋವು|വേദന|નોવ|દુખાવો|ব্যথা')
const BREATH_PHRASES = A("cant breathe|cannot breathe|difficulty breathing|trouble breathing|breathless|breathlessness|short of breath|shortness of breath|hard to breathe|struggling to breathe|saans nahi|saans lene mein takleef|saans ki takleef|saans phoolna|saans phoolti|dam ghutna|dam ghut|dam lagto|dhap lagte|dhaap lagte|shvas ghet|shvas ghyayla|sans nahi|सांस नहीं|सांस लेने में तकलीफ|सांस फूल|सांस की तकलीफ|दम घुट|दम लागतो|धाप लागते|धाप लागतेय|श्वास घेता येत नाही|श्वास घेण्यास त्रास|श्वासाचा त्रास|শ্বাসকষ্ট|শ্বাস নিতে পারছি না|மூச்சுத் திணறல்|மூச்சு விட முடியவில்லை|ఊపిరి ఆడటం లేదు|ఊపిరాడక|શ્વાસ લઈ શકાતો નથી|શ્વાસ ચડે|ಉಸಿರಾಟದ ತೊಂದರೆ|ಉಸಿರಾಡಲು ಆಗುತ್ತಿಲ್ಲ|ശ്വാസതടസ്സം|ശ്വാസം കിട്ടുന്നില്ല")
const BLOOD = A('blood|bleeding|bleed|khoon|khun|rakt|रक्त|खून|रक्ताची|ரத்தம்|రక్తం|રક્ત|ರಕ್ತ|രക്തം|রক্ত')
const HEAVY = A('heavy|severe|profuse|jyada|zyada|khup|bahut|खूप|ज्यादा|जास्त|बहुत|nonstop|non stop|continuous|lagatar|सतत|not stopping|nahi ruk|थांबत नाही|रुक नहीं|alot|lot of')
const CONF = A('confused|confusion|disoriented|drowsy|unresponsive|not responding|गोंधळ|भ्रमित|बेसुध|ajib')
export const CONCEPTS: Concept[] = [
  { id: 'chest_pain', label: 'Chest pain / pressure', tier: 'urgent', pats: [[CHEST, PAIN]] },
  { id: 'breathing', label: 'Difficulty breathing', tier: 'urgent', pats: [[BREATH_PHRASES], [A('breath|breathe|breathing|saans|sans|shvas|shwas|dam|सांस|श्वास|दम|धाप'), A('difficulty|trouble|hard|takleef|tras|problem|तकलीफ|त्रास|दिक्कत')]] },
  { id: 'unconscious', label: 'Fainted / unconscious', tier: 'urgent', pats: [[A('unconscious|fainted|passed out|collapsed|blacked out|behosh|bhosh|बेहोश|बेशुद्ध|अचेत|अज्ञान|অজ্ঞান|స్పృహ తప్పి|બેભાન|ಪ್ರಜ್ಞೆ ತಪ್ಪಿ|ബോധം പോയി')]] },
  { id: 'seizure', label: 'Seizure / fits', tier: 'urgent', pats: [[A('seizure|seizures|fits|convulsion|convulsions|daura|dora|दौरा|झटके|आकडी|खिंचाव|খিঁচুনি|வலிப்பு|మూర్ఛ|આંચકી|ಸೆಳೆತ|അപസ്മാരം')]] },
  { id: 'stroke', label: 'Possible stroke signs', tier: 'urgent', pats: [[A('paralysis|lakwa|lakva|लकवा|पक्षाघात|अर्धांग|slurred speech|slurring|face droop|one sided weakness|pakshaghat|পক্ষাঘাত|பக்கவாதம்|పక్షవాతం|લકવો|ಪಾರ್ಶ್ವವಾಯು|പക്ഷാഘാതം')], [A('face|chehra|chehre|चेहरा|चेहरे|चेहऱ्याचा'), A('droop|drooping|tedha|tedhe|crooked|वाकडा|वाकडे|टेढ़ा|टेढ़े')], [A('speech|bolne|bolna|बोलणे|बोलने|bol'), A('slurred|difficulty|takleef|tras|problem|तकलीफ|त्रास|अडखळ|लड़खड़')]] },
  { id: 'bleeding', label: 'Heavy / uncontrolled bleeding', tier: 'urgent', pats: [[BLOOD, HEAVY]] },
  { id: 'vomit_blood', label: 'Vomiting blood / black stool', tier: 'urgent', pats: [[BLOOD, A('vomit|vomiting|ulti|ulati|उलटी|उल्टी|उलट्या|வாந்தி|వాంతి|ઉલટી|ವಾಂತಿ|ഛർദ്ദി|বমি')], [A('black stool|kala mal|kali potty|काळे शौच|काला मल|melena')]] },
  { id: 'self_harm', label: 'Self-harm / suicide risk', tier: 'urgent', pats: [[A('suicide|suicidal|kill myself|end my life|want to die|wish i was dead|self harm|hurt myself|atmahatya|marne ka man|jeene ka man nahi|आत्महत्या|मरने का मन|मरना चाहता|मरना चाहती|मरावेसे वाटते|जगावेसे वाटत नाही|आत्मघात|আত্মহত্যা|தற்கொலை|ఆత్మహత్య|આત્મહત્યા|ಆತ್ಮಹತ್ಯೆ|ആത്മഹത്യ')]] },
  { id: 'poison', label: 'Poisoning / overdose / snake bite', tier: 'urgent', pats: [[A('poison|poisoning|overdose|snake|snakebite|saap|sap|zeher|jahar|pesticide|kerosene|विष|जहर|ज़हर|साप|सांप|सर्प|विषबाधा')]] },
  { id: 'anaphylaxis', label: 'Swelling of face/tongue/throat (severe allergy)', tier: 'urgent', pats: [[A('swelling|swollen|sujan|suj|सूज|सूजन|सुजन'), A('face|tongue|lips|throat|chehra|jeebh|gala|chehrya|गला|गळा|जीभ|चेहरा|चेहऱ्याला|ओठ')], [A('throat closing|anaphylaxis|tongue swelling')]] },
  { id: 'worst_headache', label: 'Sudden severe headache', tier: 'urgent', pats: [[A('worst headache|thunderclap|sudden severe headache|suddenly severe headache')]] },
  { id: 'confusion', label: 'Confusion / drowsiness', tier: 'review', pats: [[CONF]] },
  // ----- risk-context rules -----
  { id: 'infant_fever', label: 'Fever in an infant (<12 months)', tier: 'urgent', gate: (c) => infant(c), pats: [[A('fever|temperature|bukhar|tap|taap|बुखार|ताप|জ্বর|காய்ச்சல்|జ్వరం|તાવ|ಜ್ವರ|പനി')]] },
  { id: 'infant_feeding', label: 'Infant not feeding / very sleepy', tier: 'urgent', gate: (c) => infant(c), pats: [[A('not feeding|not drinking|not taking milk|refusing feed|very sleepy|lethargic|dudh nahi|doodh nahi|दूध नहीं|दूध घेत नाही|सुस्त')]] },
  { id: 'child_dehydration', label: 'Young child vomiting/diarrhoea and not drinking', tier: 'urgent', gate: (c) => (c.ageYears ?? 99) < 5, pats: [[A('not drinking|not taking fluids|no urine|pani nahi|पानी नहीं|पाणी पित नाही|सुस्त|lethargic')]] },
  { id: 'preg_bleeding', label: 'Bleeding in possible pregnancy', tier: 'urgent', gate: (c) => c.pregnant === 'yes' || c.pregnant === 'unsure', pats: [[BLOOD, A('bleeding|spotting|discharge|पाझर|स्राव|रक्तस्राव')], [A('bleeding|spotting|रक्तस्राव')]] },
  { id: 'preg_movement', label: 'Reduced baby movement', tier: 'urgent', gate: (c) => c.pregnant === 'yes', pats: [[A('baby not moving|reduced movement|less movement|no movement|baby is not moving|हालचाल कमी|हलचल कम|बाळ हलत नाही')]] },
  { id: 'preg_headache_vision', label: 'Headache with vision change in pregnancy (possible pre-eclampsia)', tier: 'urgent', gate: (c) => c.pregnant === 'yes' || c.pregnant === 'unsure', pats: [[A('headache|sirdard|डोकेदुखी|सिरदर्द'), A('blurred|blurry|vision|dhundhla|धुंधला|दिसत नाही|नजर')]] },
  { id: 'preg_abdo', label: 'Severe abdominal pain in possible pregnancy', tier: 'urgent', gate: (c) => c.pregnant === 'yes' || c.pregnant === 'unsure', pats: [[A('stomach|abdomen|belly|pet|pot|पेट|पोट'), PAIN, A('severe|bahut|khup|unbearable|सहन|खूप|बहुत')]] },
  { id: 'elder_fall', label: 'Fall in an older adult', tier: 'review', gate: (c) => (c.ageYears ?? 0) >= 65, pats: [[A('fell|fall|fallen|slipped|gir|gira|girna|पडलो|पडले|गिर|गिरा|गिरी')]] },
  { id: 'elder_confusion', label: 'New confusion in an older adult', tier: 'urgent', gate: (c) => (c.ageYears ?? 0) >= 65, pats: [[CONF]] },
]
export const infant = (c: Ctx) => (c.ageMonths != null && c.ageMonths < 12) || (c.ageYears != null && c.ageYears < 1 && c.ageMonths == null)

const SPAN = 6
function matchPattern(toks: string[], pat: Pat): [number, number] | null {
  const hits = pat.map((g) => g.flatMap((alt) => findAt(toks, phrase(alt))))
  if (hits.some((h) => !h.length)) return null
  let best: [number, number] | null = null
  const rec = (gi: number, picked: [number, number][]) => {
    if (gi === hits.length) { const s = Math.min(...picked.map((p) => p[0])), e = Math.max(...picked.map((p) => p[1])); if (e - s < SPAN + picked.length && (!best || e - s < best[1] - best[0])) best = [s, e]; return }
    for (const h of hits[gi]) rec(gi + 1, [...picked, h])
  }
  rec(0, []); return best
}

/** texts = ONLY what the patient said/typed/uploaded (never the question wording). yesPhrases = question wording of YES-answered yes/no questions. */
export function assess(texts: string[], ctx: Ctx, yesPhrases: string[] = []): Result {
  const out: Result = { urgent: [], review: [], denied: [] }
  const seen = new Set<string>()
  for (const raw of [...texts, ...yesPhrases]) {
    const isYes = yesPhrases.includes(raw)
    for (const toks of clauses(raw)) for (const c of CONCEPTS) {
      if (c.gate && !c.gate(ctx)) continue
      for (const p of c.pats) {
        const m = matchPattern(toks, p); if (!m) continue
        const [s, e] = m, before = toks.slice(Math.max(0, s - 3), s), after = toks.slice(e + 1, e + 4)
        const negated = !isYes && [...before, ...after].some((t) => NEG.has(t))
        const unsure = [...before, ...after].some((t) => UNSURE.has(t))
        if (negated) { if (!out.denied.includes(c.id)) out.denied.push(c.id); continue }
        if (seen.has(c.id)) continue
        seen.add(c.id)
        const tier: Tier = unsure && c.tier === 'urgent' ? 'review' : c.tier
        const f: Finding = { id: c.id, label: c.label, tier, evidence: toks.slice(Math.max(0, s - 1), e + 2).join(' '), ...(unsure && c.tier === 'urgent' ? { note: 'Wording suggests past or uncertain — staff to confirm' } : {}) }
        ;(tier === 'urgent' ? out.urgent : out.review).push(f)
      }
    }
  }
  if ((ctx.severity ?? 0) >= 9) out.urgent.push({ id: 'severity', label: 'Very high self-reported severity (9–10 / 10)', tier: 'urgent', evidence: `severity ${ctx.severity}` })
  // a negated concept must not hide a positive one found elsewhere
  out.denied = out.denied.filter((id) => ![...out.urgent, ...out.review].some((f) => f.id === id))
  return out
}
