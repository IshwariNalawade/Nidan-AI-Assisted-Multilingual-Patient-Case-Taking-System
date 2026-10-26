import axeCore from 'axe-core'
export async function axe(el: HTMLElement) {
  const r = await axeCore.run(el, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } }, resultTypes: ['violations'] })   // jsdom cannot compute colours
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}
