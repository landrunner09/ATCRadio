// supabase/functions/grade-explain/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ASSEMBLYAI_LLM = 'https://llm-gateway.assemblyai.com/v1/chat/completions'
const FETCH_TIMEOUT_MS = 15_000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

async function verifyUser(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return false

  const client = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { error } = await client.auth.getUser()
  return !error
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const SYSTEM_PROMPT = `You are an expert FAA-certified flight instructor specialising in VFR radio communications phraseology. A student just attempted a readback during a simulated scenario. Give concise, practical coaching.

Respond with JSON only — no markdown, no preamble:
{
  "explanation": "<1-2 sentences explaining what went wrong or what was good>",
  "aimCitation": "<AIM section reference, e.g. AIM 4-2-3(c) or empty string if none>",
  "tip": "<one actionable tip for next time>"
}`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authed = await verifyUser(req)
  if (!authed) return json({ error: 'Unauthorized' }, 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { skillTag, result, missingSlots, missingStandard, transcript } = body
  if (typeof skillTag !== 'string' || typeof result !== 'string') {
    return json({ error: 'Missing required fields: skillTag, result' }, 400)
  }

  const apiKey = Deno.env.get('ASSEMBLYAI_API_KEY')
  if (!apiKey) return json({ error: 'LLM service not configured' }, 503)

  const userContent = [
    `Skill being graded: ${skillTag.replace(/_/g, ' ')}`,
    `Result: ${result}`,
    Array.isArray(missingSlots) && missingSlots.length ? `Missing critical slots: ${missingSlots.join(', ')}` : '',
    Array.isArray(missingStandard) && missingStandard.length ? `Missing standard slots: ${missingStandard.join(', ')}` : '',
    typeof transcript === 'string' && transcript ? `Student said: "${transcript}"` : 'Student said: (nothing audible)',
  ].filter(Boolean).join('\n')

  let llmRes: Response
  try {
    llmRes = await fetchWithTimeout(ASSEMBLYAI_LLM, {
      method: 'POST',
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        max_tokens: 250,
      }),
    }, FETCH_TIMEOUT_MS)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: `LLM unreachable: ${msg}` }, 502)
  }

  if (!llmRes.ok) {
    const errBody = await llmRes.text().catch(() => '')
    return json({ error: `LLM ${llmRes.status}: ${errBody.slice(0, 200)}` }, 502)
  }

  let llmData: unknown
  try {
    llmData = await llmRes.json()
  } catch {
    return json({ error: 'LLM returned non-JSON' }, 502)
  }

  const raw = (llmData as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content ?? ''

  let coaching: { explanation: string; aimCitation: string; tip: string }
  try {
    const parsed = JSON.parse(raw)
    coaching = {
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : raw,
      aimCitation: typeof parsed.aimCitation === 'string' ? parsed.aimCitation : '',
      tip: typeof parsed.tip === 'string' ? parsed.tip : '',
    }
  } catch {
    coaching = { explanation: raw || 'Coaching unavailable', aimCitation: '', tip: '' }
  }

  return json(coaching)
})
