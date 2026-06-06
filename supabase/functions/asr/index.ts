// supabase/functions/asr/index.ts
// Hybrid ASR: try AssemblyAI Universal-3-Pro first (aviation word_boost for accuracy),
// fall back to OpenAI Whisper if AssemblyAI fails/times out.

const ASSEMBLYAI_UPLOAD = 'https://api.assemblyai.com/v2/upload'
const ASSEMBLYAI_TRANSCRIPT = 'https://api.assemblyai.com/v2/transcript'
const OPENAI_TRANSCRIPTION = 'https://api.openai.com/v1/audio/transcriptions'

// Aviation vocabulary — covers ICAO alphabet, FAA digit pronunciation,
// and the radio-call lexicon students will use.
const AVIATION_WORD_BOOST = [
  'niner', 'tree', 'fife', 'squawk', 'altimeter', 'roger', 'wilco',
  'November', 'Sierra', 'Alpha', 'Bravo', 'Charlie',
  'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India',
  'Juliet', 'Kilo', 'Lima', 'Mike', 'Oscar', 'Papa',
  'Quebec', 'Romeo', 'Tango', 'Uniform', 'Victor',
  'Whiskey', 'Xray', 'Yankee', 'Zulu',
  'runway', 'taxiway', 'cleared', 'hold short', 'contact',
  'approach', 'departure', 'pattern', 'downwind', 'base',
  'final', 'traffic', 'wind', 'visibility', 'altimeter',
  'flight following', 'ident', 'inbound', 'outbound',
  'NorCal', 'SoCal', 'Jacksonville', 'Houston',
]

// Whisper prompt mirrors the word_boost as a hint string (less powerful but cheap)
const WHISPER_AVIATION_PROMPT =
  'ATC radio communication. Aviation phraseology: niner, tree, fife, squawk, ' +
  'altimeter, November, Sierra, Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, ' +
  'Golf, Hotel, India, Juliet, Kilo, Lima, Mike, Oscar, Papa, Quebec, Romeo, ' +
  'Tango, Uniform, Victor, Whiskey, Xray, Yankee, Zulu, runway, taxiway, ' +
  'cleared, hold short, contact, approach, departure, pattern, downwind, base, ' +
  'final, traffic, wind, visibility, altimeter, flight following, ident.'

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

// ─── AssemblyAI primary path ─────────────────────────────────────────────────
async function transcribeWithAssemblyAI(audioBytes: ArrayBuffer, apiKey: string): Promise<{ transcript: string; confidence: number }> {
  // 1) Upload audio bytes (raw binary body, NOT multipart)
  const uploadRes = await fetch(ASSEMBLYAI_UPLOAD, {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/octet-stream' },
    body: audioBytes,
  })
  if (!uploadRes.ok) throw new Error(`upload failed: ${uploadRes.status}`)
  const { upload_url } = await uploadRes.json()

  // 2) Submit transcription request (Universal-3-Pro + aviation word_boost)
  const submitRes = await fetch(ASSEMBLYAI_TRANSCRIPT, {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_url: upload_url,
      speech_models: ['universal-3-pro', 'universal-2'],   // fallback chain within AssemblyAI
      word_boost: AVIATION_WORD_BOOST,
      boost_param: 'high',
      language_code: 'en_us',
    }),
  })
  if (!submitRes.ok) throw new Error(`submit failed: ${submitRes.status}`)
  const { id } = await submitRes.json()

  // 3) Poll for completion — 200ms intervals, max 8 seconds total (40 attempts)
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 200))
    const pollRes = await fetch(`${ASSEMBLYAI_TRANSCRIPT}/${id}`, {
      headers: { 'Authorization': apiKey },
    })
    if (!pollRes.ok) continue
    const data = await pollRes.json()
    if (data.status === 'completed') {
      return {
        transcript: (data.text ?? '').trim(),
        confidence: data.confidence ?? 0.5,
      }
    }
    if (data.status === 'error') {
      const msg: string = data.error ?? 'assemblyai error'
      // Silent audio handling — empty transcript is a graceful pass-through, not a fallback trigger
      if (msg.toLowerCase().includes('no spoken audio') || msg.toLowerCase().includes('language_detection') || msg.toLowerCase().includes('silent')) {
        return { transcript: '', confidence: 0 }
      }
      throw new Error(msg)
    }
  }
  throw new Error('assemblyai timed out')
}

// ─── OpenAI Whisper fallback path ────────────────────────────────────────────
async function transcribeWithWhisper(audioFile: File, apiKey: string): Promise<{ transcript: string; confidence: number }> {
  const body = new FormData()
  body.append('file', audioFile, audioFile.name || 'audio.webm')
  body.append('model', 'whisper-1')
  body.append('language', 'en')
  body.append('prompt', WHISPER_AVIATION_PROMPT)
  body.append('response_format', 'verbose_json')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)

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
      if (err.toLowerCase().includes('no speech') || err.toLowerCase().includes('audio_too_short')) {
        return { transcript: '', confidence: 0 }
      }
      throw new Error(`whisper ${res.status}: ${err.slice(0, 120)}`)
    }

    const data = await res.json() as {
      text: string
      segments?: Array<{ avg_logprob?: number }>
    }
    const transcript = (data.text ?? '').trim()
    const segments = data.segments ?? []
    const avgLogprob = segments.length > 0
      ? segments.reduce((s, seg) => s + (seg.avg_logprob ?? -1), 0) / segments.length
      : -0.5
    const confidence = Math.max(0, Math.min(1, 1 + avgLogprob))
    return { transcript, confidence }
  } finally {
    clearTimeout(timer)
  }
}

// ─── Request handler ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const assemblyKey = Deno.env.get('ASSEMBLYAI_API_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!assemblyKey && !openaiKey) {
    return json({ error: 'No ASR provider configured' }, 503)
  }

  const formData = await req.formData()
  const audioFile = formData.get('audio') as File | null
  if (!audioFile) return json({ error: 'No audio file provided' }, 400)

  // Read bytes once (AssemblyAI needs ArrayBuffer; Whisper takes the File directly)
  const audioBytes = await audioFile.arrayBuffer()

  // Try AssemblyAI first (better aviation accuracy via word_boost)
  if (assemblyKey) {
    try {
      const result = await transcribeWithAssemblyAI(audioBytes, assemblyKey)
      return json({ ...result, provider: 'assemblyai' })
    } catch (e) {
      console.warn('[asr] assemblyai failed, falling back to whisper:', e instanceof Error ? e.message : String(e))
      // fall through to Whisper
    }
  }

  // Whisper fallback
  if (openaiKey) {
    try {
      const result = await transcribeWithWhisper(audioFile, openaiKey)
      return json({ ...result, provider: 'whisper' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[asr] whisper failed:', msg)
      if (msg.includes('abort') || msg.includes('timeout')) {
        return json({ error: 'ASR timed out — please try again' }, 504)
      }
      return json({ error: `ASR failed: ${msg}` }, 502)
    }
  }

  return json({ error: 'Both ASR providers failed' }, 502)
})
