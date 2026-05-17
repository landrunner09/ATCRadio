import type { ContentPack, Beat, ScenarioContext } from '@/types/content'

export function loadPack(json: unknown): ContentPack {
  const pack = json as ContentPack
  if (!pack.beats || !Array.isArray(pack.beats)) {
    throw new Error(`Invalid content pack: missing beats array`)
  }
  // Apply defaults for fields not present in built-in JSON files
  if (!pack.scenario_type) pack.scenario_type = 'departure'
  if (pack.controlled === undefined) pack.controlled = true
  return pack
}

export function renderLine(
  template: string,
  pack: ContentPack,
  ctx: ScenarioContext,
): string {
  return template
    .replace(/{callsign}/g, ctx.callsign)
    .replace(/{runway}/g, ctx.runway_in_use)
    .replace(/{taxiway}/g, ctx.departure_taxiway)
    .replace(/{atis_letter}/g, ctx.atis_letter)
    .replace(/{weather\.wind}/g, ctx.weather.wind)
    .replace(/{weather\.vis}/g, ctx.weather.vis)
    .replace(/{weather\.altimeter}/g, ctx.weather.altimeter)
    .replace(/{altimeter}/g, ctx.weather.altimeter)
    .replace(/{approach_freq}/g, pack.approach_freq)
    .replace(/{tower_freq}/g, pack.tower_freq)
    .replace(/{squawk_code}/g, ctx.squawk_code)
    .replace(/{approach_facility}/g, ctx.approach_facility)
    .replace(/{airport_name}/g, pack.airport_name)
}

export function pickLine(beat: Beat, pack: ContentPack, ctx: ScenarioContext): string {
  // pilot_initiated beats have no ATC line to render
  if (beat.type === 'pilot_initiated') return ''
  const variants = [beat.line_template, ...(beat.line_variants ?? [])]
  const template = variants[Math.floor(Math.random() * variants.length)]
  return renderLine(template, pack, ctx)
}

export function getBeat(pack: ContentPack, beatId: string): Beat {
  const beat = pack.beats.find(b => b.id === beatId)
  if (!beat) throw new Error(`Beat not found: ${beatId}`)
  return beat
}

export function getBeatIndex(pack: ContentPack, beatId: string): number {
  return pack.beats.findIndex(b => b.id === beatId)
}
