import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'tts-cache'
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech'

// ─── Aviation number expansion ────────────────────────────────────────────────
const DIGIT: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'niner',
}

function spellDigits(s: string): string {
  return [...s].map(c => DIGIT[c] ?? c).join(' ')
}

function expandAviationText(text: string): string {
  let s = text

  // ── ATIS letter — single-letter phonetic expansion ────────────────────────────
  // "information D" → "information Delta". Phonetic words ("information Delta")
  // pass through unchanged.
  const PHONETIC: Record<string, string> = {
    A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo',
    F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet',
    K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar',
    P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
    U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee',
    Z: 'Zulu',
  }
  s = s.replace(/\binformation\s+([A-Z])\b/g, (_m, l) => `information ${PHONETIC[l]}`)

  // ── Aviation digit names (FAA: 9 → "niner", reused across rules below) ───────
  const DIGIT_NAMES = ['zero','one','two','three','four','five','six','seven','eight','niner']
  const spellDigits = (s: string) => s.split('').map(d => DIGIT_NAMES[+d]).join(' ')

  // ── N-number callsigns — "N73324" → "November seven three three two four" ───
  // Matches N + 1-5 digits + 0-2 trailing letters (e.g. N12345, N8472K, N1AB).
  // FAA AIM 4-2-4: the N-prefix is spoken as "November" on initial contact and
  // remains conventional throughout the trainer for realism. Case-insensitive.
  s = s.replace(/\bN(\d{1,5})([A-Za-z]{0,2})\b/g, (_m, digits: string, letters: string) => {
    const numPart = spellDigits(digits)
    const letterPart = letters
      ? ' ' + letters.toUpperCase().split('').map(l => PHONETIC[l] ?? l).join(' ')
      : ''
    return `November ${numPart}${letterPart}`
  })

  // ── Runway designators — "25R" → "two five right", "31L" → "three one left" ──
  // L/R/C are the direction qualifier per AIM 4-3-1, NOT phonetic letters.
  // Handle this BEFORE the generic letter expansion below.
  const DIRECTION: Record<string, string> = { L: 'left', R: 'right', C: 'center' }
  s = s.replace(/\brunway\s+(\d{1,2})\s*([LRClrc])\b/g, (_m, num: string, dir: string) => {
    const dirWord = DIRECTION[dir.toUpperCase()]
    return `runway ${spellDigits(num.padStart(2, '0'))} ${dirWord}`
  })
  // Runway without direction letter
  s = s.replace(/\brunway\s+(\d{1,2})\b/g, (_m, num: string) => {
    return `runway ${spellDigits(num.padStart(2, '0'))}`
  })
  // Standalone "hold short of runway 25R" / "via 25 left" mentions of the
  // direction letter alone (already handled by the runway pattern above when
  // attached, this catches "the 25 right" style omissions).
  s = s.replace(/\b(\d{1,2})\s*([LRC])\b(?!\s*kHz)/g, (_m, num: string, dir: string) => {
    return `${spellDigits(num)} ${DIRECTION[dir]}`
  })

  // ── Taxiway / via single-letter IDs — "taxiway A" → "taxiway Alpha" ─────────
  // Covers taxi instructions, hand-off ("contact ground via C"), etc.
  s = s.replace(/\b(taxiway|taxi|via|on)\s+([A-Z])\b/g, (_m, prefix: string, l: string) => {
    return `${prefix} ${PHONETIC[l] ?? l}`
  })

  // ── Altimeter — always four digits ──────────────────────────────────────────
  // "altimeter 30.02" or "altimeter 3002" → "altimeter three zero zero two"
  s = s.replace(/\baltimeter\s+(\d{2})\.?(\d{2})\b/gi, (_m, hi, lo) => {
    const digits = (hi + lo).split('').map((d: string) => DIGIT_NAMES[+d]).join(' ')
    return `altimeter ${digits}`
  })

  // ── Wind — "wind 250 at 8" → "wind two five zero at eight" ──────────────────
  // Handles calm, variable, gust
  s = s.replace(/\bwind\s+calm\b/gi, 'wind calm')
  s = s.replace(/\bwind\s+VRB(\d{1,3})\b/gi, (_m, kt) => {
    const speedDigits = kt.split('').map((d: string) => DIGIT_NAMES[+d]).join(' ')
    return `wind variable at ${speedDigits}`
  })
  s = s.replace(/\bwind\s+(\d{3})\s*(?:at|@)\s*(\d{1,3})(?:\s*G\s*(\d{1,3}))?/gi, (_m, dir, spd, gust) => {
    const digits = (n: string) => n.split('').map((d: string) => DIGIT_NAMES[+d]).join(' ')
    let out = `wind ${digits(dir)} at ${digits(spd)}`
    if (gust) out += ` gust ${digits(gust)}`
    return out
  })

  // ── Frequencies — three-digit + decimal ────────────────────────────────────
  s = s.replace(/\b(\d{3})\.(\d{1,3})\b/g, (_m, hi, dec) => {
    const left = hi.split('').map((d: string) => DIGIT_NAMES[+d]).join(' ')
    const right = dec.split('').map((d: string) => DIGIT_NAMES[+d]).join(' ')
    return `${left} point ${right}`
  })

  // ── Squawk — four digits ───────────────────────────────────────────────────
  s = s.replace(/\bsquawk\s+(\d{4})\b/gi, (_m, code) => {
    const digits = code.split('').map((d: string) => DIGIT_NAMES[+d]).join(' ')
    return `squawk ${digits}`
  })

  return s
}

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  const { text: rawText, voiceName, instructions } = await req.json()
  if (!rawText || !voiceName) {
    return json({ error: 'Missing required fields' }, 400)
  }

  // B18: forbidden phrases per AIM 4-2-3 / AC 90-66C — strip if present
  let cleanedText = rawText
  const FORBIDDEN = [
    /\bwith you\b/gi,
    /\bany traffic in the area please advise\b/gi,
    /\bfor the numbers\b/gi,
  ]
  for (const re of FORBIDDEN) {
    if (re.test(cleanedText)) {
      console.warn('[tts] forbidden phrase removed:', re.source)
      cleanedText = cleanedText.replace(re, '').replace(/\s{2,}/g, ' ').trim()
    }
  }

  // Normalize before hashing so whitespace differences don't produce different cache keys
  const text = expandAviationText(cleanedText.trim().replace(/\s+/g, ' '))

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // v9: comprehensive phonetic expansion — runway L/R/C → left/right/center,
  // taxiway/via letters → ICAO phonetic (Alpha/Bravo/etc.), N-numbers expanded
  const instructionHash = instructions ? await sha256hex(instructions) : 'default'
  const cacheKey = await sha256hex(`v9:${voiceName}:${instructionHash}:${text}`)
  const filename = `${cacheKey}.mp3`

  // Check storage cache first
  const { data: existing } = await supabase.storage.from(BUCKET).getPublicUrl(filename)
  const headRes = await fetch(existing.publicUrl, { method: 'HEAD' })
  if (headRes.ok) {
    return json({ url: existing.publicUrl })
  }

  // Cache miss — call OpenAI TTS
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const ttsBody: Record<string, unknown> = {
    model: 'gpt-4o-mini-tts',
    voice: voiceName,
    input: text,
  }
  if (instructions) ttsBody.instructions = instructions

  const ttsRes = await fetch(OPENAI_TTS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ttsBody),
  })

  if (!ttsRes.ok) {
    const err = await ttsRes.text()
    return json({ error: `OpenAI TTS error: ${err}` }, 502)
  }

  const audioBytes = new Uint8Array(await ttsRes.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, audioBytes, { contentType: 'audio/mpeg', upsert: true })

  if (uploadError && uploadError.message !== 'The resource already exists') {
    return json({ error: uploadError.message }, 500)
  }

  const { data: uploaded } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  return json({ url: uploaded.publicUrl })
})
