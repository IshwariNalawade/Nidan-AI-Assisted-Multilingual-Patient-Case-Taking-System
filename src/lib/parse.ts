const DEV = '०१२३४५६७८९', BEN = '০১২৩৪৫৬৭৮৯', GUJ = '૦૧૨૩૪૫૬૭૮૯', TAM = '௦௧௨௩௪௫௬௭௮௯', TEL = '౦౧౨౩౪౫౬౭౮౯', KAN = '೦೧೨೩೪೫೬೭೮೯', MAL = '൦൧൨൩൪൫൬൭൮൯'
export function normDigits(s: string) {
  return [DEV, BEN, GUJ, TAM, TEL, KAN, MAL].reduce((acc, set) => acc.replace(new RegExp(`[${set}]`, 'g'), (c) => String(set.indexOf(c))), s)
}
const EN_NUM: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
/** Digits from a spoken phrase: "forty two" -> "42", "९८७६५" -> "98765". Returns '' when no number is found. */
export function spokenNumber(text: string, mode: 'age' | 'phone'): string {
  const t = normDigits(text.toLowerCase())
  const digits = t.replace(/[^0-9]/g, '')
  if (digits) return mode === 'phone' ? digits.slice(0, 10) : digits.slice(0, 3)
  const words = t.split(/[\s-]+/)
  if (mode === 'phone') return words.map((w) => (w in EN_NUM && EN_NUM[w] < 10 ? String(EN_NUM[w]) : '')).join('').slice(0, 10)
  let total = 0, found = false
  for (const w of words) if (w in EN_NUM) { total += EN_NUM[w]; found = true }
  return found ? String(total) : ''
}
const speechText = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[.,!?;:।'"()[\]{}<>/\\_-]/g, ' ').replace(/\s+/g, ' ').trim()
const tokens = (s: string) => speechText(s).split(' ').filter(Boolean)
export interface Choice { value: string; words: string[] }
/** Returns the choice only when exactly one option is matched (whole-word match); otherwise null. */
export function matchChoice(text: string, choices: Choice[]): string | null {
  const normalized = speechText(text), tk = tokens(normalized), joined = ` ${normalized} `
  const hit = choices.filter((c) => c.words.some((w) => {
    const phrase = speechText(w)
    return Boolean(phrase) && (phrase.includes(' ') ? joined.includes(` ${phrase} `) : tk.includes(phrase))
  }))
  const values = [...new Set(hit.map((c) => c.value))]
  return values.length === 1 ? values[0] : null
}
