import { normalizePhonetic } from './normalizer'
import type { Beat, ContentPack, ScenarioContext, SlotDefinition } from '@/types/content'
import type { GradeResult, SlotMatch } from '@/types/grader'

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

/**
 * All surface forms a runway designator can take in a transcript.
 * "25r" → ["25r", "25 right", "25 r", "25"]
 * "31l" → ["31l", "31 left", "31 l", "31"]
 * "12"  → ["12"]  (no suffix, return as-is)
 */
function runwayForms(normRunway: string): string[] {
  const forms: string[] = [normRunway]
  const m = normRunway.match(/^(\d{1,2})([lrc])$/)
  if (m) {
    const [, num, dir] = m
    const word = { l: 'left', r: 'right', c: 'center' }[dir as 'l' | 'r' | 'c']
    forms.push(`${num} ${word}`, `${num} ${dir}`, num) // "31 left", "31 l", "31"
  }
  return forms
}

/**
 * Per-slot matching logic that reflects real ATC/pilot phrasing flexibility.
 *
 * Philosophy:
 *  - Safety-critical items (hold short, cleared for takeoff/land) require the
 *    key safety phrase but are lenient about surrounding words.
 *  - Most other items just need the meaningful content words to appear anywhere
 *    in the transcript — pilots don't always say every preposition.
 */
function slotPresentInTranscript(
  transcript: string,
  resolvedValue: string,
  slot: string,
): boolean {
  if (!resolvedValue) return false
  const v = normalizePhonetic(resolvedValue)
  const t = transcript

  switch (slot) {
    case 'hold_short_of': {
      // "Hold short" is mandatory (safety). Runway designator (any form) must follow it.
      // Accepts: "hold short runway 25", "hold short 25 right", "hold short of runway 25R"
      const idx = t.indexOf('hold short')
      if (idx === -1) return false
      const after = t.slice(idx)
      return runwayForms(v).some(f => after.includes(f))
    }

    case 'runway': {
      // Runway number must appear; directional suffix (L/R/C) is optional.
      // Accepts: "runway 25R", "runway 25 right", "runway 25", "two five right"
      return runwayForms(v).some(f => t.includes(f))
    }

    case 'via': {
      // Taxiway name must appear. "Via" keyword is nice-to-have but not required.
      // Accepts: "via alpha", "taxiway alpha", "alpha"
      return t.includes(v)
    }

    case 'pattern_leg': {
      // Just check the leg name appears. (downwind / base / final)
      return t.includes(v)
    }

    case 'action': {
      // Multi-word actions: each meaningful word must appear somewhere in the transcript
      // (not necessarily adjacent). Stop-words "for / to / of" are skipped.
      // "cleared for takeoff" → requires "cleared" AND "takeoff"
      // "cleared to land"    → requires "cleared" AND "land"
      // "ready"              → requires "ready"
      // "inbound"            → requires "inbound"
      const keywords = v.split(/\s+/).filter(w => !['for', 'to', 'of'].includes(w))
      return keywords.every(w => t.includes(w))
    }

    case 'callsign': {
      // FAA/ATC abbreviated callsign rules (AIM 4-2-4):
      //   Full: N8472K
      //   Drop N-prefix: 8472K
      //   Last 4 alphanumeric: 472K
      //   Last 3 alphanumeric (standard abbreviated after initial contact): 72K
      const parts = v.replace(/\s+/g, '')
      const tns = t.replace(/\s+/g, '')
      if (tns.includes(parts)) return true
      const suffix = parts.startsWith('n') ? parts.slice(1) : parts
      if (suffix && tns.includes(suffix)) return true
      if (suffix.length >= 4 && tns.includes(suffix.slice(-4))) return true
      if (suffix.length >= 3 && tns.includes(suffix.slice(-3))) return true
      return false
    }

    case 'squawk': {
      // Squawk code digits must appear together in sequence.
      // "squawk four five two three" → normalised "squawk 4523" → "4523" found.
      // The word "squawk" is not required — the digits alone are sufficient.
      return t.replace(/\s+/g, '').includes(v.replace(/\s+/g, ''))
    }

    case 'frequency': {
      // Frequency digits must appear in order; "point" separator is already normalised.
      return t.includes(v)
    }

    case 'destination': {
      // Airport name; also accept with hyphens replaced by spaces (Reid-Hillview → Reid Hillview)
      if (t.includes(v)) return true
      return t.includes(v.replace(/-/g, ' '))
    }

    case 'altitude': {
      // Value is the meta-marker "altitude" — accept if student mentioned any
      // number followed by "feet", "thousand", or "hundred" anywhere.
      // This is standard-criticality only so missing it won't fail the student.
      return /\d+\s*(feet|thousand|hundred)|\bft\b/.test(t) || t.includes('feet')
    }

    default: {
      // Simple substring match for all other slots
      return t.includes(v)
    }
  }
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

  // Callsign is always treated as critical — pilots must identify themselves.
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
