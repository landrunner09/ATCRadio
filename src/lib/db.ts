// src/lib/db.ts
import { supabase } from '@/lib/supabase'
import type { ScenarioContext } from '@/types/content'
import type { AttemptRecord } from '@/types/grader'

export async function createRun(userId: string, scenarioContext: ScenarioContext): Promise<string> {
  const { data, error } = await supabase
    .from('runs')
    .insert({ user_id: userId, scenario_context: scenarioContext })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function saveAttempt(runId: string, attempt: AttemptRecord): Promise<void> {
  const { error } = await supabase.from('attempts').insert({
    run_id: runId,
    beat_id: attempt.beatId,
    skill_tag: attempt.skillTag,
    result: attempt.result,
    transcript: attempt.gradeResult?.rawTranscript ?? null,
    asr_confidence: attempt.gradeResult?.confidence ?? null,
    missing_slots: attempt.gradeResult
      ? { critical: attempt.gradeResult.missingCritical, standard: attempt.gradeResult.missingStandard }
      : null,
  })
  if (error) console.warn('[db] saveAttempt failed:', error.message)
}

export async function closeRun(runId: string, finalScore: number): Promise<void> {
  const { error } = await supabase
    .from('runs')
    .update({ ended_at: new Date().toISOString(), final_score: finalScore })
    .eq('id', runId)
  if (error) console.warn('[db] closeRun failed:', error.message)
}
