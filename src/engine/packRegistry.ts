import { loadPack } from '@/engine/loader'
import type { ContentPack } from '@/types/content'
import KPAO_JSON from '@/content/KPAO.json'
import KSQL_JSON from '@/content/KSQL.json'
import KRHV_JSON from '@/content/KRHV.json'
import KLVK_JSON from '@/content/KLVK.json'

export const BUILTIN_PACKS: Record<string, ContentPack> = {
  KPAO: loadPack(KPAO_JSON),
  KSQL: loadPack(KSQL_JSON),
  KRHV: loadPack(KRHV_JSON),
  KLVK: loadPack(KLVK_JSON),
}

export const BUILTIN_ICAOS = Object.keys(BUILTIN_PACKS)

export function getPack(icao: string, customPacks: Record<string, ContentPack>): ContentPack {
  return BUILTIN_PACKS[icao] ?? customPacks[icao] ?? BUILTIN_PACKS['KPAO']
}

/**
 * Returns the arrival pack for an airport, or null if not yet generated.
 * Built-in packs have no pre-built arrival — always generated on demand.
 */
export function getArrivalPack(
  icao: string,
  arrivalPacks: Record<string, ContentPack>,
): ContentPack | null {
  return arrivalPacks[icao] ?? null
}
