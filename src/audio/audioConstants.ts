// Maps accent keys → OpenAI TTS voice names.
// Voices chosen for ATC authority and clarity.
export const VOICES: Record<string, { languageCode: string; name: string }> = {
  american:   { languageCode: 'en-US', name: 'onyx' },   // Deep, authoritative
  british:    { languageCode: 'en-GB', name: 'fable' },  // Measured, clear
  indian:     { languageCode: 'en-IN', name: 'echo' },   // Informative, neutral
  australian: { languageCode: 'en-AU', name: 'alloy' },  // Steady, clear
}

export const DEFAULT_ACCENT = 'american'

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
