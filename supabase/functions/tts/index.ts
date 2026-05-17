import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'tts-cache'
const GEMINI_TTS_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent'

// ─── Aviation number expansion ────────────────────────────────────────────────
// FAA standard: digits read individually, "9" → "niner", frequencies digit-by-digit.

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
  // First char after N must be a digit (excludes "NorCal", "November", etc.)
  t = t.replace(/\bN(\d[A-Z0-9]{1,4})\b/g, (_, suffix) =>
    `November ${[...suffix].map(c => DIGIT[c] ?? c).join(' ')}`
  )

  // Frequencies: 3 digits + decimal (e.g., 118.6, 135.275, 124.0)
  t = t.replace(/\b(\d{3})\.(\d{1,3})\b/g, (_, int, dec) =>
    `${spellDigits(int)} point ${spellDigits(dec)}`
  )

  // Altimeter: "altimeter 29.92" or "altimeter 2992" → "two niner niner two"
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

  // Runway numbers: "runway 31", "runway 13L/R/C"
  t = t.replace(/\brunway\s+(\d{1,2})([LRC]?)\b/gi, (_, num, suf) => {
    const spelled = spellDigits(num.padStart(2, '0'))
    const sufWords: Record<string, string> = { L: ' left', R: ' right', C: ' center' }
    return `runway ${spelled}${sufWords[suf.toUpperCase()] ?? ''}`
  })

  // Squawk codes: exactly 4 digits after "squawk"
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

// Wraps raw PCM bytes in a RIFF WAV container (16-bit, mono, 24kHz)
function pcmToWav(pcm: Uint8Array, sampleRate = 24000, numChannels = 1, bitDepth = 16): Uint8Array {
  const byteRate = (sampleRate * numChannels * bitDepth) / 8
  const blockAlign = (numChannels * bitDepth) / 8
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const write = (offset: number, value: number, size: number) =>
    size === 4 ? view.setUint32(offset, value, true) : view.setUint16(offset, value, true)
  const writeStr = (offset: number, str: string) =>
    [...str].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))

  writeStr(0, 'RIFF')
  write(4, 36 + pcm.byteLength, 4)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  write(16, 16, 4)
  write(20, 1, 2)
  write(22, numChannels, 2)
  write(24, sampleRate, 4)
  write(28, byteRate, 4)
  write(32, blockAlign, 2)
  write(34, bitDepth, 2)
  writeStr(36, 'data')
  write(40, pcm.byteLength, 4)

  const wav = new Uint8Array(44 + pcm.byteLength)
  wav.set(new Uint8Array(header), 0)
  wav.set(pcm, 44)
  return wav
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

  const { text: rawText, voiceName, languageCode } = await req.json()
  if (!rawText || !voiceName || !languageCode) {
    return json({ error: 'Missing required fields' }, 400)
  }

  // Expand to aviation-standard spoken form before synthesis and cache lookup
  const text = expandAviationText(rawText)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // v4: Gemini backend with ATC system instruction + aviation number expansion
  const cacheKey = await sha256hex(`v4:${languageCode}:${voiceName}:${text}`)
  const filename = `${cacheKey}.wav`

  // Check cache
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .getPublicUrl(filename)

  const headRes = await fetch(existing.publicUrl, { method: 'HEAD' })
  if (headRes.ok) {
    return json({ url: existing.publicUrl })
  }

  // Cache miss — call Gemini TTS
  // Note: system_instruction causes 500s on the TTS preview endpoint — omitted.
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  const ttsRes = await fetch(`${GEMINI_TTS_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    }),
  })

  if (!ttsRes.ok) {
    const err = await ttsRes.text()
    return json({ error: `Gemini TTS error: ${err}` }, 502)
  }

  const ttsJson = await ttsRes.json()
  const inlineData = ttsJson.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!inlineData?.data) {
    return json({ error: 'No audio data in Gemini response' }, 502)
  }

  const pcmBytes = Uint8Array.from(atob(inlineData.data), (c) => c.charCodeAt(0))
  const wavBytes = pcmToWav(pcmBytes)

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, wavBytes, {
      contentType: 'audio/wav',
      upsert: true,
    })

  if (uploadError && uploadError.message !== 'The resource already exists') {
    return json({ error: uploadError.message }, 500)
  }

  const { data: uploaded } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  return json({ url: uploaded.publicUrl })
})
