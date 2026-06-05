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
  let t = text

  // N-numbers: "N12345" → "November one two three four five"
  t = t.replace(/\bN(\d[A-Z0-9]{1,4})\b/g, (_, suffix) =>
    `November ${[...suffix].map(c => DIGIT[c] ?? c).join(' ')}`
  )

  // Frequencies: "118.6" → "one one eight point six"
  t = t.replace(/\b(\d{3})\.(\d{1,3})\b/g, (_, int, dec) =>
    `${spellDigits(int)} point ${spellDigits(dec)}`
  )

  // Altimeter: "altimeter 29.92" → "altimeter two niner niner two"
  t = t.replace(/\baltimeter\s+(\d{2})\.?(\d{2})\b/gi, (_, maj, min) =>
    `altimeter ${spellDigits(maj + min)}`
  )

  // Wind: "wind 270 at 8" → "wind two seven zero at eight"
  t = t.replace(/\bwind\s+(\d{3})\s+at\s+(\d+)\b/gi, (_, dir, spd) =>
    `wind ${spellDigits(dir)} at ${spellDigits(spd)}`
  )

  // Visibility: "visibility 10" → "visibility one zero"
  t = t.replace(/\bvisibility\s+(\d+)\b/gi, (_, vis) =>
    `visibility ${spellDigits(vis)}`
  )

  // Runway numbers: "runway 31L" → "runway three one left"
  t = t.replace(/\brunway\s+(\d{1,2})([LRC]?)\b/gi, (_, num, suf) => {
    const spelled = spellDigits(num.padStart(2, '0'))
    const sufWords: Record<string, string> = { L: ' left', R: ' right', C: ' center' }
    return `runway ${spelled}${sufWords[suf.toUpperCase()] ?? ''}`
  })

  // Squawk codes: "squawk 4521" → "squawk four five two one"
  t = t.replace(/\bsquawk\s+(\d{4})\b/gi, (_, code) =>
    `squawk ${spellDigits(code)}`
  )

  return t
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

  const { text: rawText, voiceName } = await req.json()
  if (!rawText || !voiceName) {
    return json({ error: 'Missing required fields' }, 400)
  }

  // Normalize before hashing so whitespace differences don't produce different cache keys
  const text = expandAviationText(rawText.trim().replace(/\s+/g, ' '))

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // v5: OpenAI backend — cache key includes voice and expanded text
  const cacheKey = await sha256hex(`v5:${voiceName}:${text}`)
  const filename = `${cacheKey}.mp3`

  // Check storage cache first
  const { data: existing } = await supabase.storage.from(BUCKET).getPublicUrl(filename)
  const headRes = await fetch(existing.publicUrl, { method: 'HEAD' })
  if (headRes.ok) {
    return json({ url: existing.publicUrl })
  }

  // Cache miss — call OpenAI TTS
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const ttsRes = await fetch(OPENAI_TTS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice: voiceName,
      input: text,
    }),
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
