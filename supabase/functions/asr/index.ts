// supabase/functions/asr/index.ts
// Speech-to-text via OpenAI Whisper — synchronous, no polling, ~1-3 s latency.
// Aviation vocabulary hinted via the `prompt` parameter.

const OPENAI_TRANSCRIPTION = 'https://api.openai.com/v1/audio/transcriptions'

// Aviation prompt hint: primes Whisper to expect ATC phraseology and avoids
// common mishearings (e.g. "niner" vs "nine", "tree" vs "three").
const AVIATION_PROMPT =
  'ATC radio communication. Aviation phraseology: niner, tree, fife, squawk, altimeter, ' +
  'November, Sierra, Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India, ' +
  'Juliet, Kilo, Lima, Mike, Oscar, Papa, Quebec, Romeo, Tango, Uniform, Victor, ' +
  'Whiskey, Xray, Yankee, Zulu. ' +
  'Runway, taxiway, cleared, hold short, contact, approach, departure, pattern, ' +
  'downwind, base, final, traffic, wind, visibility, altimeter, flight following.'

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
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return json({ error: 'ASR service not configured' }, 503)

  const formData = await req.formData()
  const audioFile = formData.get('audio') as File | null
  if (!audioFile) return json({ error: 'No audio file provided' }, 400)

  // Forward audio to Whisper as multipart/form-data
  const body = new FormData()
  body.append('file', audioFile, audioFile.name || 'audio.webm')
  body.append('model', 'whisper-1')
  body.append('language', 'en')
  body.append('prompt', AVIATION_PROMPT)
  body.append('response_format', 'verbose_json') // includes confidence-ish data

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000) // 20s hard timeout

  try {
    const res = await fetch(OPENAI_TRANSCRIPTION, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body,
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      const err = await res.text()
      // No speech / silent audio → treat as empty transcript, not an error
      if (err.toLowerCase().includes('no speech') || err.toLowerCase().includes('audio_too_short')) {
        return json({ transcript: '', confidence: 0 })
      }
      return json({ error: `Whisper error: ${err.slice(0, 200)}` }, 502)
    }

    const data = await res.json() as {
      text: string
      segments?: Array<{ no_speech_prob?: number; avg_logprob?: number }>
    }

    const transcript = (data.text ?? '').trim()

    // Derive a rough confidence from Whisper's segment metadata
    const segments = data.segments ?? []
    const avgLogprob = segments.length > 0
      ? segments.reduce((s, seg) => s + (seg.avg_logprob ?? -1), 0) / segments.length
      : -0.5
    // Map log-probability to 0–1 confidence: logprob=0 → 1.0, logprob≤-1 → ≈0
    const confidence = Math.max(0, Math.min(1, 1 + avgLogprob))

    return json({ transcript, confidence })
  } catch (e) {
    clearTimeout(timer)
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('abort') || msg.includes('timeout')) {
      return json({ error: 'ASR timed out — please try again' }, 504)
    }
    return json({ error: msg }, 500)
  }
})
