import { WORD_BOOST_LIST } from './wordBoost.ts'

const ASSEMBLYAI_UPLOAD = 'https://api.assemblyai.com/v2/upload'
const ASSEMBLYAI_TRANSCRIPT = 'https://api.assemblyai.com/v2/transcript'

async function poll(id: string, apiKey: string, maxAttempts = 60): Promise<{ transcript: string; confidence: number }> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${ASSEMBLYAI_TRANSCRIPT}/${id}`, {
      headers: { authorization: apiKey },
    })
    const data = await res.json()
    if (data.status === 'completed') {
      return {
        transcript: data.text ?? '',
        confidence: data.confidence ?? 0,
      }
    }
    if (data.status === 'error') {
      throw new Error(data.error ?? 'AssemblyAI transcription failed')
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('Transcription timed out after 30 seconds')
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

  const apiKey = Deno.env.get('ASSEMBLYAI_API_KEY')!
  const formData = await req.formData()
  const audioFile = formData.get('audio') as File | null

  if (!audioFile) {
    return json({ error: 'No audio file provided' }, 400)
  }

  // Upload audio to AssemblyAI
  const audioBytes = await audioFile.arrayBuffer()
  const uploadRes = await fetch(ASSEMBLYAI_UPLOAD, {
    method: 'POST',
    headers: { authorization: apiKey, 'Content-Type': 'application/octet-stream' },
    body: audioBytes,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    return json({ error: `Upload failed: ${err}` }, 502)
  }

  const { upload_url } = await uploadRes.json()

  // Submit transcription job with word boost
  const transcriptRes = await fetch(ASSEMBLYAI_TRANSCRIPT, {
    method: 'POST',
    headers: { authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_url: upload_url,
      speech_models: ['universal-3-pro', 'universal-2'],
      word_boost: WORD_BOOST_LIST,
      boost_param: 'high',
    }),
  })

  if (!transcriptRes.ok) {
    const err = await transcriptRes.text()
    return json({ error: `Transcription submit failed: ${err}` }, 502)
  }

  const { id } = await transcriptRes.json()

  try {
    const result = await poll(id, apiKey)
    return json(result)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
