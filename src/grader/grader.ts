import { normalizePhonetic } from './normalizer'
import type { Beat, ContentPack, ScenarioContext, SlotDefinition } from '@/types/content'
import type { GradeResult, SlotMatch } from '@/types/grader'

// Maps slot names to required prefix keywords that must appear before the value
const SLOT_REQUIRED_PREFIX: Record<string, string> = {
  hold_short_of: 'hold short',
  via: 'via',
  runway: 'runway',
  pattern_leg: 'downwind',
}

function resolveSlotValue(value: string, ctx: ScenarioContext, pack: ContentPack): string {
  return value
    .replace(/{callsign}/g, ctx.callsign.toLowerCase())
    .replace(/{runway}/g, ctx.runway_in_use)
    .replace(/{taxiway}/g, ctx.departure_taxiway)
    .replace(/{atis_letter}/g, ctx.atis_letter.toLowerCase())
    .replace(/{altimeter}/g, ctx.weather.altimeter)
    .replace(/{approach_freq}/g, pack.approach_freq)
    .replace(/{tower_freq}/g, pack.tower_freq)
    .replace(/{squawk_code}/g, ctx.squawk_code)
    .replace(/{airport_name}/g, pack.airport_name.toLowerCase())
}

function slotPresentInTranscript(
  normalizedTranscript: string,
  resolvedValue: string,
  slot: string,
): boolean {
  if (!resolvedValue) return false  // guard against empty resolved values
  const normValue = normalizePhonetic(resolvedValue)

  const requiredPrefix = SLOT_REQUIRED_PREFIX[slot]
  if (requiredPrefix) {
    const regex = new RegExp(`${requiredPrefix}[\\s\\w]*${normValue}`)
    return regex.test(normalizedTranscript)
  }

  if (normalizedTranscript.includes(normValue)) return true

  // For callsign: check all chars appear in sequence without spaces.
  // Also accept the suffix without the leading "N" — FAA allows pilots to
  // drop the N-prefix after initial contact (e.g. "8472 Kilo" for "N8472K").
  if (slot === 'callsign') {
    const parts = normValue.replace(/\s+/g, '')
    const transcriptNoSpace = normalizedTranscript.replace(/\s+/g, '')
    if (transcriptNoSpace.includes(parts)) return true
    // Strip leading 'n' (November) and try suffix alone
    const suffix = parts.startsWith('n') ? parts.slice(1) : ''
    if (suffix && transcriptNoSpace.includes(suffix)) return true
    return false
  }

  return false
}

export function gradeResponse(
  rawTranscript: string,
  beat: Beat,
  scenarioContext: ScenarioContext,
  confidence: number,
  pack: ContentPack,
): GradeResult {
  const normalizedTranscript = normalizePhonetic(rawTranscript)
  const slots = beat.expected_student_response.required_slots

  const slotMatches: SlotMatch[] = slots.map((def: SlotDefinition) => {
    const resolved = resolveSlotValue(def.value, scenarioContext, pack)
    const matched = slotPresentInTranscript(normalizedTranscript, resolved, def.slot)
    return {
      slot: def.slot,
      expected: resolved,
      found: matched ? resolved : null,
      matched,
      criticality: def.criticality,
    }
  })

  // Callsign is always critical — you must identify yourself regardless of
  // what the content JSON marks its criticality as.
  const missingCritical = slotMatches
    .filter(m => !m.matched && (m.criticality === 'critical' || m.slot === 'callsign'))
    .map(m => m.slot)

  const missingStandard = slotMatches
    .filter(m => !m.matched && m.criticality === 'standard')
    .map(m => m.slot)

  const passed = missingCritical.length === 0

  return {
    passed,
    missingCritical,
    missingStandard,
    slotMatches,
    confidence,
    rawTranscript,
    normalizedTranscript,
  }
}
