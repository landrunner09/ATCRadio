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

/** Random 4-digit octal squawk code, excluding reserved codes 7500/7600/7700. */
function randomSquawk(): string {
  const forbidden = new Set(['7500', '7600', '7700'])
  let code: string
  do {
    code = Array.from({ length: 4 }, () => Math.floor(Math.random() * 8)).join('')
  } while (forbidden.has(code))
  return code
}

export function generateScenarioContext(
  pack?: Pick<ContentPack, 'airport_icao' | 'runways' | 'taxiways'>,
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
    approach_facility: 'Approach',
    ...overrides,
  }
}
