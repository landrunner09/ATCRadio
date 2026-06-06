import type { ContentPack, ScenarioContext } from '@/types/content'

const CALLSIGNS = ['N12345', 'N8472K', 'N3391V', 'N5527P', 'N7219Q']
const ATIS_LETTERS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot']
const WINDS = [
  'three one zero at eight',
  'two niner zero at one two',
  'three zero zero at six',
  'three two zero at one zero',
  'two eight zero at one four',
]
const KPAO_RUNWAYS = ['31']
const ALTIMETERS = [
  'three zero zero two',
  'two niner niner eight',
  'three zero one zero',
  'two niner niner two',
  'three zero zero five',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomAtisTime(): string {
  // 4-digit Zulu time (HHMM). Pick anywhere between 1200Z and 2200Z (typical VFR daylight).
  const hour = 12 + Math.floor(Math.random() * 10)
  const min = Math.floor(Math.random() * 6) * 10
  return `${String(hour).padStart(2, '0')}${String(min).padStart(2, '0')}`
}

const SKY_CONDITIONS = [
  'few clouds at five thousand',
  'scattered clouds at six thousand',
  'clear below one two thousand',
  'few clouds at four thousand five hundred',
]

/** Random 4-digit octal squawk code, excluding reserved codes. */
function randomSquawk(): string {
  // Reserved codes that ATC never assigns for flight following:
  //   1200 — VFR squawk (default)
  //   7000 — CTAF / advisory non-radar
  //   7500 — hijack
  //   7600 — lost comms
  //   7700 — emergency
  const forbidden = new Set(['1200', '7000', '7500', '7600', '7700'])
  let code: string
  do {
    code = Array.from({ length: 4 }, () => Math.floor(Math.random() * 8)).join('')
  } while (forbidden.has(code))
  return code
}

export function generateScenarioContext(
  pack?: Pick<ContentPack, 'airport_icao' | 'runways' | 'taxiways' | 'approach_facility'>,
  overrides?: Partial<ScenarioContext>,
  tailNumber?: string,
): ScenarioContext {
  const runways = pack?.runways?.length ? pack.runways : KPAO_RUNWAYS
  const taxiway = pack?.taxiways?.length ? pick(pack.taxiways) : 'alpha'
  const icao = pack?.airport_icao?.toLowerCase() ?? 'kpao'
  return {
    callsign: tailNumber?.trim() ? tailNumber.trim().toUpperCase() : pick(CALLSIGNS),
    aircraft_type: 'C172',
    runway_in_use: pick(runways),
    weather: {
      wind: pick(WINDS),
      vis: '10SM',
      altimeter: pick(ALTIMETERS),
      sky: pick(SKY_CONDITIONS),
      temp: String(15 + Math.floor(Math.random() * 15)),     // 15-29 C
      dewpoint: String(5 + Math.floor(Math.random() * 10)),   // 5-14 C
    },
    atis_letter: pick(ATIS_LETTERS),
    departure_taxiway: taxiway,
    destination: 'practice_area_west',
    controller_voice_ids: {
      [`${icao}_tower`]: 'stub_tower',
      norcal_approach: 'stub_approach',
      [`${icao}_atis`]: 'stub_atis',
    },
    squawk_code: randomSquawk(),
    approach_facility: pack?.approach_facility ?? 'Approach',
    atis_time: randomAtisTime(),
    notams: 'No NOTAMs',
    ...overrides,
  }
}
