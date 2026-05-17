import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const AVWX_URL = 'https://aviationweather.gov/api/data/airport'
const LLM_URL = 'https://llm-gateway.assemblyai.com/v1/chat/completions'
const FETCH_TIMEOUT_MS = 12_000

function cors(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function verifyUser(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return false
  const client = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { error } = await client.auth.getUser()
  return !error
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

interface AvwxRunway { id?: string; alignment?: number }
interface AvwxAirport {
  name?: string            // was wrongly typed as 'site'
  state?: string
  runways?: AvwxRunway[]
  // Verified 2026-05-13: AviationWeather API uses semicolon between pairs, comma within each pair.
  // e.g. "LCL/P,118.6;ATIS,135.275" — split(';') is correct.
  freqs?: string
}

function parseFreqs(raw: string | undefined): Array<{ type: string; freq: number; freqStr: string }> {
  if (!raw) return []
  return raw.split(';').flatMap(pair => {
    const [typeRaw, freqStr] = pair.split(',')
    const freq = parseFloat(freqStr ?? '')
    return freq > 0 ? [{ type: (typeRaw ?? '').trim().toLowerCase(), freq, freqStr: (freqStr ?? '').trim() }] : []
  })
}

async function fetchAirportData(icao: string) {
  try {
    const res = await fetchWithTimeout(
      `${AVWX_URL}?ids=${encodeURIComponent(icao)}&format=json`,
      { headers: { 'User-Agent': 'ATCRadio/1.0' } },
      FETCH_TIMEOUT_MS,
    )
    if (!res.ok) return null
    const raw: unknown = await res.json()
    if (!Array.isArray(raw) || !raw[0]) return null
    const ap = raw[0] as AvwxAirport

    // Parse freqs string: "LCL/P,118.6;ATIS,135.275"
    const freqs = parseFreqs(ap.freqs)
    const find = (keywords: string[]) =>
      freqs.find(f => keywords.some(k => f.type.includes(k)))

    const tower = find(['lcl', 'twr', 'tower', 'ct-'])
    const atis  = find(['atis', 'asos', 'awos'])
    // Note: approach/departure control (TRACON) is regional, not in airport freqs.
    // Class D airports have no separate ground — Tower handles ground on tower freq.

    // Extract both ends of each runway (exclude helipads starting with H)
    const runways = (ap.runways ?? [])
      .filter(r => !(r.id ?? '').toUpperCase().startsWith('H'))
      .flatMap(r => (r.id ?? '').split('/').map(s => s.trim()))
      .filter(r => /^\d{1,2}[LRC]?$/.test(r))
      .slice(0, 6) // max 3 physical runways × 2 ends

    // Clean up the name: API returns "PALO ALTO/PALO ALTO " — take part after last slash, trim
    const rawName = typeof ap.name === 'string'
      ? ap.name.split('/').pop()?.trim().replace(/\s+/g, ' ') ?? icao
      : icao

    return {
      name: rawName,
      city: typeof ap.state === 'string' ? ap.state : '',
      runways: runways.length > 0 ? runways : ['31', '13'],
      taxiways: ['alpha', 'bravo'],
      tower_freq: tower ? tower.freqStr : '',  // empty string = uncontrolled
      approach_freq: '124.0', // TRACON not in airport data; keep fallback
      atis_freq: atis ? atis.freqStr : '120.6',
    }
  } catch {
    return null
  }
}

async function enhanceWithLLM(icao: string, rawName: string, apiKey: string) {
  try {
    const res = await fetchWithTimeout(LLM_URL, {
      method: 'POST',
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `For airport ${icao} (raw database name: "${rawName}"), return JSON with exactly these keys:
- airport_name: friendly short name (e.g. "San Francisco International")
- city: "City, ST" format
- scenario_name: brief scenario title (e.g. "KSFO Full Pattern Flight")
- scenario_description: one sentence describing VFR pattern flight

Return only valid JSON, no markdown, no extra keys.`,
        }],
      }),
    }, FETCH_TIMEOUT_MS)

    if (!res.ok) return null
    const data: unknown = await res.json()
    const content = (data as { choices?: { message?: { content?: string } }[] })
      ?.choices?.[0]?.message?.content ?? ''

    const parsed: unknown = JSON.parse(content)
    if (typeof parsed !== 'object' || parsed === null) return null
    const p = parsed as Record<string, unknown>

    return {
      airport_name: typeof p.airport_name === 'string' ? p.airport_name : rawName,
      city: typeof p.city === 'string' ? p.city : '',
      scenario_name: typeof p.scenario_name === 'string' ? p.scenario_name : `${icao} Full Pattern Flight`,
      scenario_description: typeof p.scenario_description === 'string'
        ? p.scenario_description
        : `Full VFR pattern flight at ${icao}.`,
    }
  } catch {
    return null
  }
}

// Module-level slot helpers — shared by all beat builders
const std = (slot: string, value: string) => ({ slot, value, criticality: 'standard' })
const crit = (slot: string, value: string) => ({ slot, value, criticality: 'critical' })

function buildBeats(prefix: string, airportName: string, towerName: string) {
  const b = (id: string, phase: string, skill: string, speaker: string, voiceRole: string,
    tmpl: string, variants: string[], slots: { slot: string; value: string; criticality: string }[],
    nextId: string, missingCritical: string[] = []) => ({
    id: `${prefix}.${id}`,
    phase,
    skill_tag: skill,
    speaker,
    voice_role: voiceRole,
    line_template: tmpl,
    line_variants: variants,
    expected_student_response: {
      type: 'readback',
      required_slots: slots,
      phraseology_hints: [],
    },
    on_pass: { next: nextId === '__debrief__' ? '__debrief__' : `${prefix}.${nextId}` },
    on_partial: {
      missing_critical: missingCritical,
      controller_correction: '{callsign}, say again.',
      retry_same_beat: true,
      max_retries: 2,
    },
    on_fail_after_retries: {
      scaffold_mode: true,
      next_after_scaffold_pass: nextId === '__debrief__' ? '__debrief__' : `${prefix}.${nextId}`,
    },
    on_say_again: { replay_audio: true },
  })

  const twr = `${prefix}_tower`

  return [
    b('atis.listen', 'LISTEN_ATIS', 'atis_extraction', 'atis', `${prefix}_atis`,
      `${airportName} Airport information {atis_letter}. Wind {weather.wind}, visibility {weather.vis}, altimeter {weather.altimeter}. Runway {runway} in use. Advise on initial contact you have information {atis_letter}.`,
      [`${airportName} information {atis_letter}, wind {weather.wind}. Altimeter {weather.altimeter}. Active runway {runway}. Inform ${towerName} you have information {atis_letter}.`],
      [std('atis_letter', '{atis_letter}'), std('runway', '{runway}'), std('altimeter', '{altimeter}')],
      'taxi.request'),

    b('taxi.request', 'TAXI_REQUEST', 'taxi_request', 'tower', twr,
      `{callsign}, ${towerName}, go ahead.`,
      [`${towerName}, {callsign}.`],
      [std('callsign', '{callsign}'), std('action', 'taxi'), std('atis_letter', '{atis_letter}')],
      'taxi.clearance'),

    b('taxi.clearance', 'TAXI', 'taxi_readback', 'tower', twr,
      `{callsign}, ${towerName}, taxi to runway {runway} via {taxiway}, hold short of runway {runway}.`,
      ['{callsign}, taxi runway {runway} via taxiway {taxiway}, hold short {runway}.'],
      [std('runway', '{runway}'), std('via', '{taxiway}'), crit('hold_short_of', '{runway}'), std('callsign', '{callsign}')],
      'runup.ready', ['hold_short_of']),

    b('runup.ready', 'RUNUP_HOLD', 'runup_ready', 'tower', twr,
      '{callsign}, hold short runway {runway}, traffic on final.',
      ['{callsign}, hold short runway {runway}, landing traffic.'],
      [crit('hold_short_of', '{runway}'), std('callsign', '{callsign}')],
      'takeoff.clearance', ['hold_short_of']),

    b('takeoff.clearance', 'TAKEOFF_CLEARANCE', 'takeoff_readback', 'tower', twr,
      '{callsign}, runway {runway}, cleared for takeoff, wind {weather.wind}.',
      ['{callsign}, cleared takeoff runway {runway}, wind {weather.wind}.'],
      [std('action', 'cleared'), std('runway', '{runway}'), std('callsign', '{callsign}')],
      'departure.freq'),

    b('departure.freq', 'DEPARTURE', 'freq_change_readback', 'tower', twr,
      '{callsign}, contact Approach on {approach_freq}, good day.',
      ['{callsign}, frequency change approved, Approach {approach_freq}.'],
      [crit('frequency', '{approach_freq}'), std('callsign', '{callsign}')],
      'practice.checkin', ['frequency']),

    b('practice.checkin', 'PRACTICE_AREA', 'position_report_approach', 'approach', 'approach_control',
      '{callsign}, Approach, radar contact, squawk 4523, report leaving the practice area.',
      ['{callsign}, Approach, radar contact, squawk 4523.'],
      [std('callsign', '{callsign}'), std('squawk', '4523')],
      'return.request'),

    b('return.request', 'RETURN_INBOUND', 'inbound_call', 'approach', 'approach_control',
      `{callsign}, cleared to return to ${airportName}, contact Tower on {tower_freq}.`,
      [`{callsign}, ${airportName} altimeter {weather.altimeter}, contact ${towerName} {tower_freq}.`],
      [crit('frequency', '{tower_freq}'), std('callsign', '{callsign}')],
      'pattern.entry', ['frequency']),

    b('pattern.entry', 'PATTERN_ENTRY', 'pattern_entry_readback', 'tower', twr,
      '{callsign}, enter left downwind runway {runway}, number two, follow the Skyhawk on downwind.',
      ['{callsign}, left downwind runway {runway}, number two traffic.'],
      [std('pattern_leg', 'downwind'), std('runway', '{runway}'), std('callsign', '{callsign}')],
      'landing.clearance'),

    b('landing.clearance', 'LANDING_CLEARANCE', 'landing_readback', 'tower', twr,
      '{callsign}, runway {runway}, cleared to land, wind {weather.wind}.',
      ['{callsign}, cleared land runway {runway}, wind {weather.wind}.'],
      [std('action', 'cleared'), std('runway', '{runway}'), std('callsign', '{callsign}')],
      'taxi.parking'),

    b('taxi.parking', 'TAXI_TO_PARKING', 'taxi_to_parking_readback', 'tower', twr,
      '{callsign}, taxi to parking via {taxiway}.',
      ['{callsign}, taxi to parking via {taxiway}, see ya.'],
      [std('via', '{taxiway}'), std('callsign', '{callsign}')],
      '__debrief__'),
  ]
}

function buildToweredArrivalBeats(
  prefix: string,
  airportName: string,
  towerName: string,
  approachFacility: string,
) {
  const twr = `${prefix}_tower`

  // pilot_initiated beat builder
  const pi = (
    id: string, phase: string, skill: string, cueText: string,
    slots: { slot: string; value: string; criticality: string }[],
    nextId: string,
  ) => ({
    id: `${prefix}.${id}`,
    phase,
    skill_tag: skill,
    type: 'pilot_initiated',
    cue_text: cueText,
    speaker: 'tower',
    voice_role: twr,
    line_template: '',
    line_variants: [],
    expected_student_response: { type: 'readback', required_slots: slots, phraseology_hints: [] },
    on_pass: { next: nextId === '__debrief__' ? '__debrief__' : `${prefix}.${nextId}` },
    on_partial: { missing_critical: [], controller_correction: '{callsign}, say again.', retry_same_beat: true, max_retries: 2 },
    on_fail_after_retries: { scaffold_mode: true, next_after_scaffold_pass: nextId === '__debrief__' ? '__debrief__' : `${prefix}.${nextId}` },
    on_say_again: { replay_audio: true },
  })

  // readback beat builder
  const rb = (
    id: string, phase: string, skill: string, speaker: string, voiceRole: string,
    tmpl: string, variants: string[],
    slots: { slot: string; value: string; criticality: string }[],
    nextId: string, missingCritical: string[] = [],
  ) => ({
    id: `${prefix}.${id}`,
    phase,
    skill_tag: skill,
    type: 'readback',
    speaker,
    voice_role: voiceRole,
    line_template: tmpl,
    line_variants: variants,
    expected_student_response: { type: 'readback', required_slots: slots, phraseology_hints: [] },
    on_pass: { next: nextId === '__debrief__' ? '__debrief__' : `${prefix}.${nextId}` },
    on_partial: { missing_critical: missingCritical, controller_correction: '{callsign}, say again.', retry_same_beat: true, max_retries: 2 },
    on_fail_after_retries: { scaffold_mode: true, next_after_scaffold_pass: nextId === '__debrief__' ? '__debrief__' : `${prefix}.${nextId}` },
    on_say_again: { replay_audio: true },
  })

  return [
    // Beat 1: ATIS
    rb('arr.atis.listen', 'LISTEN_ATIS', 'atis_extraction', 'atis', `${prefix}_atis`,
      `${airportName} Airport information {atis_letter}. Wind {weather.wind}, visibility {weather.vis}, altimeter {weather.altimeter}. Runway {runway} in use. Advise on initial contact you have information {atis_letter}.`,
      [`${airportName} information {atis_letter}, wind {weather.wind}. Altimeter {weather.altimeter}. Active runway {runway}.`],
      [std('atis_letter', '{atis_letter}'), std('runway', '{runway}'), std('altimeter', '{altimeter}')],
      'arr.approach.call'),

    // Beat 2: Pilot calls approach inbound (pilot_initiated)
    pi('arr.approach.call', 'APPROACH_CALL', 'approach_call',
      `You're 10 miles out — call ${approachFacility} inbound with your callsign, position, altitude, and ATIS letter`,
      [std('callsign', '{callsign}'), std('atis_letter', '{atis_letter}')],
      'arr.squawk.assign'),

    // Beat 3: Approach assigns squawk
    rb('arr.squawk.assign', 'SQUAWK_ASSIGN', 'squawk_readback', 'approach', 'approach_control',
      `{callsign}, ${approachFacility}, radar contact, squawk {squawk_code}, altimeter {weather.altimeter}.`,
      [`{callsign}, squawk {squawk_code}.`],
      [crit('squawk', '{squawk_code}'), std('callsign', '{callsign}')],
      'arr.approach.handoff', ['squawk']),

    // Beat 4: Approach hands off to tower
    rb('arr.approach.handoff', 'APPROACH_HANDOFF', 'freq_change_readback', 'approach', 'approach_control',
      `{callsign}, contact ${towerName} on {tower_freq}.`,
      [`{callsign}, ${towerName} {tower_freq}, good day.`],
      [crit('frequency', '{tower_freq}'), std('callsign', '{callsign}')],
      'arr.tower.call', ['frequency']),

    // Beat 5: Pilot calls tower (pilot_initiated)
    pi('arr.tower.call', 'TOWER_CALL', 'tower_call',
      `You're on the ${towerName} frequency — check in with your callsign and runway`,
      [std('callsign', '{callsign}'), std('runway', '{runway}')],
      'arr.pattern.entry'),

    // Beat 6: Pattern entry
    rb('arr.pattern.entry', 'PATTERN_ENTRY', 'pattern_entry_readback', 'tower', twr,
      '{callsign}, enter left downwind runway {runway}, number two, follow the Skyhawk on downwind.',
      ['{callsign}, left downwind runway {runway}, number two traffic.'],
      [std('pattern_leg', 'downwind'), std('runway', '{runway}'), std('callsign', '{callsign}')],
      'arr.landing.clearance'),

    // Beat 7: Landing clearance
    rb('arr.landing.clearance', 'LANDING_CLEARANCE', 'landing_readback', 'tower', twr,
      '{callsign}, runway {runway}, cleared to land, wind {weather.wind}.',
      ['{callsign}, cleared land runway {runway}, wind {weather.wind}.'],
      [std('action', 'cleared'), std('runway', '{runway}'), std('callsign', '{callsign}')],
      'arr.clear.runway'),

    // Beat 8: Pilot announces clear of runway (pilot_initiated)
    pi('arr.clear.runway', 'CLEAR_OF_RUNWAY', 'clear_of_runway',
      `You've cleared the runway — announce clear to ${towerName}`,
      [std('callsign', '{callsign}'), std('action', 'clear')],
      'arr.taxi.parking'),

    // Beat 9: Taxi to parking
    rb('arr.taxi.parking', 'TAXI_TO_PARKING', 'taxi_to_parking_readback', 'tower', twr,
      '{callsign}, taxi to parking via {taxiway}.',
      ['{callsign}, taxi to parking via {taxiway}, see ya.'],
      [std('via', '{taxiway}'), std('callsign', '{callsign}')],
      '__debrief__'),
  ]
}

function buildCtafBeats(prefix: string, airportName: string) {
  const pi = (
    id: string, phase: string, skill: string, cueText: string,
    slots: { slot: string; value: string; criticality: string }[],
    nextId: string,
  ) => ({
    id: `${prefix}.${id}`,
    phase,
    skill_tag: skill,
    type: 'pilot_initiated',
    cue_text: cueText,
    speaker: 'tower',
    voice_role: 'ctaf',
    line_template: '',
    line_variants: [],
    expected_student_response: { type: 'readback', required_slots: slots, phraseology_hints: [] },
    on_pass: { next: nextId === '__debrief__' ? '__debrief__' : `${prefix}.${nextId}` },
    on_partial: { missing_critical: [], controller_correction: '', retry_same_beat: true, max_retries: 2 },
    on_fail_after_retries: { scaffold_mode: true, next_after_scaffold_pass: nextId === '__debrief__' ? '__debrief__' : `${prefix}.${nextId}` },
    on_say_again: { replay_audio: true },
  })

  return [
    pi('ctaf.enroute', 'CTAF_ENROUTE', 'ctaf_enroute',
      `10 miles out — announce inbound on CTAF (say airport name twice: "${airportName} traffic … ${airportName}")`,
      [crit('callsign', '{callsign}'), std('airport_name', '{airport_name}')],
      'ctaf.downwind'),

    pi('ctaf.downwind', 'CTAF_DOWNWIND', 'ctaf_downwind',
      `Entering left downwind — self-announce on CTAF`,
      [crit('callsign', '{callsign}'), std('airport_name', '{airport_name}'), std('pattern_leg', 'downwind'), std('runway', '{runway}')],
      'ctaf.base'),

    pi('ctaf.base', 'CTAF_BASE', 'ctaf_base',
      `Turning base — self-announce on CTAF`,
      [crit('callsign', '{callsign}'), std('airport_name', '{airport_name}'), std('pattern_leg', 'base'), std('runway', '{runway}')],
      'ctaf.final'),

    pi('ctaf.final', 'CTAF_FINAL', 'ctaf_final',
      `Short final — self-announce on CTAF`,
      [crit('callsign', '{callsign}'), std('airport_name', '{airport_name}'), std('runway', '{runway}')],
      'ctaf.clear'),

    pi('ctaf.clear', 'CTAF_CLEAR', 'ctaf_clear',
      `You've cleared the runway — announce clear on CTAF`,
      [crit('callsign', '{callsign}'), std('airport_name', '{airport_name}')],
      '__debrief__'),
  ]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return cors({ error: 'Method not allowed' }, 405)

  const authed = await verifyUser(req)
  if (!authed) return cors({ error: 'Unauthorized' }, 401)

  let icao: string
  let scenarioType: 'departure' | 'arrival' = 'departure'
  try {
    const body: unknown = await req.json()
    if (typeof body !== 'object' || body === null) throw new Error()
    icao = String((body as Record<string, unknown>).icao ?? '').trim().toUpperCase()
    const st = (body as Record<string, unknown>).scenario_type
    if (st === 'arrival') scenarioType = 'arrival'
  } catch {
    return cors({ error: 'Invalid request body' }, 400)
  }

  // Strict ICAO validation — alphanumeric only, 3-4 chars
  if (!/^[A-Z0-9]{3,4}$/.test(icao)) return cors({ error: 'Invalid ICAO code' }, 400)

  const apiKey = Deno.env.get('ASSEMBLYAI_API_KEY') ?? ''
  // Use lowercase letters only as beat prefix to prevent path traversal
  const prefix = icao.toLowerCase().replace(/[^a-z0-9]/g, '')

  const airportData = await fetchAirportData(icao)
  const rawName = airportData?.name ?? icao

  let llmData = null
  if (apiKey) llmData = await enhanceWithLLM(icao, rawName, apiKey)

  const airportName = llmData?.airport_name ?? rawName
  const city = llmData?.city ?? airportData?.city ?? ''
  const towerName = `${airportName.split(/[\s,]/)[0]} Tower`
  const runways = airportData?.runways ?? ['18', '36']
  const taxiways = airportData?.taxiways ?? ['alpha']
  const towerFreq = airportData?.tower_freq ?? ''
  const controlled = !!towerFreq
  const approachFacility = 'Approach'

  let beats: unknown[]
  let scenarioName: string
  let scenarioDescription: string
  let estimatedMin: number

  if (scenarioType === 'arrival') {
    if (controlled) {
      beats = buildToweredArrivalBeats(prefix, airportName, towerName, approachFacility)
      scenarioName = `${icao} Inbound Arrival`
      scenarioDescription = `Practice inbound comms at ${airportName}: approach call, squawk readback, pattern entry, and landing.`
      estimatedMin = 10
    } else {
      beats = buildCtafBeats(prefix, airportName)
      scenarioName = `${icao} CTAF Pattern`
      scenarioDescription = `Self-announce at uncontrolled ${airportName}: 10-mile call through clear of runway.`
      estimatedMin = 8
    }
  } else {
    beats = buildBeats(prefix, airportName, towerName)
    scenarioName = llmData?.scenario_name ?? `${icao} Full Pattern Flight`
    scenarioDescription = llmData?.scenario_description
      ?? `Full VFR pattern flight at ${icao}: ATIS, taxi, takeoff, practice area, return, pattern, landing.`
    estimatedMin = 15
  }

  const pack = {
    airport_icao: icao,
    airport_name: airportName,
    city,
    tower_freq: towerFreq, // empty string for uncontrolled airports
    approach_freq: airportData?.approach_freq ?? '124.0',
    atis_freq: airportData?.atis_freq ?? '120.6',
    ctaf_freq: controlled ? undefined : (airportData?.atis_freq || '122.8'),
    pattern_altitude_ft: 1000,
    runways,
    taxiways,
    scenario_type: scenarioType,
    controlled,
    scenario_name: scenarioName,
    scenario_description: scenarioDescription,
    estimated_duration_min: estimatedMin,
    beats,
  }

  return cors(pack)
})
