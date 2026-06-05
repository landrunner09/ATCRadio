/**
 * Maps airport ICAO prefix → OpenAI TTS voice + controller persona instruction.
 * Voice and accent are automatically chosen based on the airport's country/region —
 * no user selection needed.
 */
export interface ControllerVoice {
  name: string        // OpenAI voice id
  instructions: string  // ATC persona prompt for gpt-4o-mini-tts
}

export function getVoiceForAirport(icao: string): ControllerVoice {
  const p = (icao ?? '').toUpperCase()

  // United Kingdom — EG prefix
  if (p.startsWith('EG')) return {
    name: 'fable',
    instructions: 'You are a professional UK CAA air traffic controller. Speak with a measured, authoritative British accent. Use crisp ICAO-standard phraseology. Tone: calm, precise, slightly formal.',
  }
  // Ireland — EI prefix
  if (p.startsWith('EI')) return {
    name: 'fable',
    instructions: 'You are a professional IAA air traffic controller. Speak with a measured Irish accent. Use crisp ICAO-standard phraseology. Tone: calm, authoritative.',
  }
  // Australia — Y prefix
  if (p.startsWith('Y')) return {
    name: 'alloy',
    instructions: 'You are a professional Airservices Australia air traffic controller. Speak with a clear, measured Australian accent. Use standard ICAO phraseology. Tone: calm, authoritative, efficient.',
  }
  // New Zealand — NZ prefix
  if (p.startsWith('NZ')) return {
    name: 'alloy',
    instructions: 'You are a professional Airways NZ air traffic controller. Speak with a clear New Zealand accent. Use standard ICAO phraseology. Tone: calm, professional.',
  }
  // India — VI, VT prefix
  if (p.startsWith('VI') || p.startsWith('VT')) return {
    name: 'echo',
    instructions: 'You are a professional AAI air traffic controller. Speak with a clear, measured Indian English accent. Use ICAO-standard phraseology. Tone: formal, authoritative, precise.',
  }
  // Canada — C prefix
  if (p.startsWith('C')) return {
    name: 'onyx',
    instructions: 'You are a professional Nav Canada air traffic controller. Speak with a clear, measured Canadian accent. Use standard ICAO phraseology. Tone: calm, efficient, professional.',
  }
  // Default — USA (K, P prefix) and all others
  return {
    name: 'onyx',
    instructions: 'You are a professional FAA-certified air traffic controller. Speak with a clear, authoritative American accent. Use crisp, clipped FAA standard phraseology. Tone: efficient, professional, no-nonsense — exactly like a real tower or approach controller.',
  }
}

// AssemblyAI word boost — aviation vocabulary that ASR models commonly mishear
export const WORD_BOOST = [
  'niner', 'tree', 'fife', 'squawk', 'altimeter',
  'november', 'sierra', 'alpha', 'bravo', 'charlie',
  'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india',
  'juliet', 'kilo', 'lima', 'mike', 'oscar', 'papa',
  'quebec', 'romeo', 'tango', 'uniform', 'victor',
  'whiskey', 'x-ray', 'yankee', 'zulu',
  'runway', 'taxiway', 'cleared', 'hold short', 'contact',
  'approach', 'departure', 'pattern', 'downwind', 'base',
  'final', 'traffic', 'wind', 'visibility',
]
