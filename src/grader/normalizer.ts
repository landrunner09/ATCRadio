const ICAO_TO_LETTER: Record<string, string> = {
  alpha: 'a', bravo: 'b', charlie: 'c', delta: 'd', echo: 'e',
  foxtrot: 'f', golf: 'g', hotel: 'h', india: 'i', juliet: 'j',
  kilo: 'k', lima: 'l', mike: 'm', november: 'n', oscar: 'o',
  papa: 'p', quebec: 'q', romeo: 'r', sierra: 's', tango: 't',
  uniform: 'u', victor: 'v', whiskey: 'w', xray: 'x', yankee: 'y',
  zulu: 'z',
}

const SPOKEN_DIGIT: Record<string, string> = {
  zero: '0', one: '1', two: '2', tree: '3', three: '3',
  four: '4', fife: '5', five: '5', six: '6', seven: '7',
  eight: '8', niner: '9', nine: '9',
  // Tens used in frequency readout ("one twenty one" → 121)
  twenty: '20', thirty: '30', forty: '40', fifty: '50',
  sixty: '60', seventy: '70', eighty: '80', ninety: '90',
}

const SPOKEN_FREQ_WORD: Record<string, string> = {
  point: '.', decimal: '.',
}

export function normalizePhonetic(text: string): string {
  if (!text) return ''
  let s = text.toLowerCase().trim()

  // Replace ICAO words with letters
  for (const [word, letter] of Object.entries(ICAO_TO_LETTER)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'g'), letter)
  }

  // Replace spoken digits
  for (const [word, digit] of Object.entries(SPOKEN_DIGIT)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'g'), digit)
  }

  // Replace frequency words
  for (const [word, sym] of Object.entries(SPOKEN_FREQ_WORD)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'g'), sym)
  }

  // Collapse tens words like "twenty" ("1 20 1") → strip trailing zero of tens when
  // preceded by a single digit: "1 20" → "12", so "1 20 1" → "121"
  s = s.replace(/(\d)\s+(20|30|40|50|60|70|80|90)\b/g, (_m, d, t) => d + t[0])

  // Collapse digit sequences separated by spaces (e.g. "1 2 1 . 3" → "121.3")
  s = s.replace(/(\d)\s+(?=[\d.])/g, '$1')
  s = s.replace(/(\d)\s*\.\s*(\d)/g, '$1.$2')

  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim()

  return s
}
