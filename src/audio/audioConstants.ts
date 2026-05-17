// Maps accent keys → Gemini TTS voice names.
// Firm/even voices chosen for ATC cadence; ATC system instruction applied server-side.
export const VOICES: Record<string, { languageCode: string; name: string }> = {
  american:   { languageCode: 'en-US', name: 'Alnilam' },   // Firm, steady
  british:    { languageCode: 'en-GB', name: 'Schedar' },   // Even, measured
  indian:     { languageCode: 'en-IN', name: 'Rasalghul' }, // Informative, clear
  australian: { languageCode: 'en-AU', name: 'Gacrux' },    // Mature, authoritative
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
