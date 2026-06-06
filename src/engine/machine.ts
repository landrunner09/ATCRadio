import { createMachine, assign } from 'xstate'
import type { ContentPack, Beat, ScenarioContext } from '@/types/content'
import type { AttemptRecord, GradeResult } from '@/types/grader'
import { gradeResponse } from '@/grader/grader'

interface ScenarioMachineContext {
  pack: ContentPack | null
  scenarioContext: ScenarioContext | null
  beatIndex: number
  retryCount: number
  attempts: AttemptRecord[]
  lastGradeResult: GradeResult | null
}

type ScenarioEvent =
  | { type: 'START'; pack: ContentPack; scenarioContext: ScenarioContext }
  | { type: 'CONFIRM' }
  | { type: 'TUNED' }
  | { type: 'LISTEN_TAPPED' }
  | { type: 'ATC_DONE' }
  | { type: 'RESPOND'; transcript: string; confidence: number }
  | { type: 'SAY_AGAIN' }
  | { type: 'SHOW_TILES' }
  | { type: 'SCAFFOLD_PASS' }

function currentBeat(ctx: ScenarioMachineContext): Beat | null {
  if (!ctx.pack) return null
  return ctx.pack.beats[ctx.beatIndex] ?? null
}

function isLastBeat(ctx: ScenarioMachineContext): boolean {
  if (!ctx.pack) return false
  return ctx.beatIndex >= ctx.pack.beats.length - 1
}

function runGrader(
  ctx: ScenarioMachineContext,
  transcript: string,
  confidence: number,
): GradeResult | null {
  const beat = currentBeat(ctx)
  if (!beat || !ctx.scenarioContext || !ctx.pack) return null
  return gradeResponse(transcript, beat, ctx.scenarioContext, confidence, ctx.pack)
}

/** A response "effectively passes" when no critical slots are missing AND at least one slot
 *  (critical or standard) was recognised in the transcript.  This prevents a completely
 *  garbled/empty utterance from advancing a beat whose slots are all marked `standard`.
 *  Exception: listen_only beats have no slots — if passed=true, always advance. */
function effectivelyPassed(grade: GradeResult | null): boolean {
  if (!grade) return false
  if (!grade.passed) return false
  // No slots to match (e.g. listen_only ATIS beat) — auto-advance
  if (grade.slotMatches.length === 0) return true
  return grade.slotMatches.some(m => m.matched)
}

function beatHasTuneTo(ctx: ScenarioMachineContext): boolean {
  const beat = currentBeat(ctx)
  return !!beat?.tune_to
}

function beatIsListenOnly(ctx: ScenarioMachineContext): boolean {
  const beat = currentBeat(ctx)
  return !!beat?.listen_only
}

function beatIsPilotInitiated(ctx: ScenarioMachineContext): boolean {
  const beat = currentBeat(ctx)
  return beat?.type === 'pilot_initiated'
}

function makeAttemptRecord(
  ctx: ScenarioMachineContext,
  result: AttemptRecord['result'],
  grade: GradeResult | null,
): AttemptRecord[] {
  const beat = currentBeat(ctx)
  if (!beat) return ctx.attempts
  return [
    ...ctx.attempts,
    { beatId: beat.id, skillTag: beat.skill_tag, result, gradeResult: grade, timestamp: Date.now() },
  ]
}

export const scenarioMachine = createMachine(
  {
    id: 'scenario',
    initial: 'idle',
    types: {} as {
      context: ScenarioMachineContext
      events: ScenarioEvent
    },
    context: {
      pack: null,
      scenarioContext: null,
      beatIndex: 0,
      retryCount: 0,
      attempts: [],
      lastGradeResult: null,
    },
    states: {
      idle: {
        on: {
          START: [
            // Defensive: empty beats array → jump straight to debrief (drill mode with no selection, etc.)
            {
              guard: ({ event }) => event.type === 'START' && (event.pack?.beats?.length ?? 0) === 0,
              target: 'debrief',
              actions: assign({
                pack: ({ event }) => event.type === 'START' ? event.pack : null,
                scenarioContext: ({ event }) => event.type === 'START' ? event.scenarioContext : null,
                beatIndex: 0,
                retryCount: 0,
                attempts: [],
                lastGradeResult: null,
              }),
            },
            // Normal path
            {
              target: 'preflight',
              actions: assign({
                pack: ({ event }) => event.type === 'START' ? event.pack : null,
                scenarioContext: ({ event }) => event.type === 'START' ? event.scenarioContext : null,
                beatIndex: 0,
                retryCount: 0,
                attempts: [],
                lastGradeResult: null,
              }),
            },
          ],
        },
      },

      preflight: {
        on: {
          CONFIRM: { target: 'tuning_or_speaking' },
        },
      },

      tuning_or_speaking: {
        initial: 'gate',
        states: {
          gate: {
            always: [
              { guard: ({ context }) => beatHasTuneTo(context), target: 'tuning' },
              { guard: ({ context }) => beatIsListenOnly(context), target: 'atc_speaking' },
              { guard: ({ context }) => beatIsPilotInitiated(context), target: 'awaiting_response' },
              { target: 'atc_speaking' },
            ],
          },

          tuning: {
            on: {
              TUNED: [
                { guard: ({ context }) => beatIsListenOnly(context), target: 'awaiting_listen' },
                { guard: ({ context }) => beatIsPilotInitiated(context), target: 'awaiting_response' },
                { target: 'atc_speaking' },
              ],
            },
          },

          awaiting_listen: {
            on: {
              LISTEN_TAPPED: { target: 'atc_speaking' },
            },
          },

          atc_speaking: {
            on: {
              ATC_DONE: [
                {
                  guard: ({ context }) => beatIsListenOnly(context) && isLastBeat(context),
                  target: '#scenario.debrief',
                  actions: assign({
                    attempts: ({ context }) => makeAttemptRecord(context, 'pass', null),
                  }),
                },
                {
                  guard: ({ context }) => beatIsListenOnly(context),
                  target: 'gate',
                  actions: assign({
                    beatIndex: ({ context }) => context.beatIndex + 1,
                    retryCount: 0,
                    attempts: ({ context }) => makeAttemptRecord(context, 'pass', null),
                  }),
                },
                { target: 'awaiting_response' },
              ],
            },
          },

          awaiting_response: {
            on: {
              SAY_AGAIN: { target: 'atc_speaking' },
              SHOW_TILES: { target: '#scenario.scaffold' },
              RESPOND: [
                // Empty transcript / no speech: stay put, do not consume retry (A7)
                {
                  guard: ({ event }) => event.type === 'RESPOND' && !event.transcript.trim(),
                  target: 'awaiting_response',
                },
                // Pass + last beat → debrief
                {
                  guard: ({ context, event }) => {
                    if (event.type !== 'RESPOND') return false
                    const grade = runGrader(context, event.transcript, event.confidence)
                    return effectivelyPassed(grade) && isLastBeat(context)
                  },
                  target: '#scenario.debrief',
                  actions: assign(({ context, event }) => {
                    if (event.type !== 'RESPOND') return {}
                    const grade = runGrader(context, event.transcript, event.confidence)
                    return {
                      lastGradeResult: grade,
                      attempts: makeAttemptRecord(context, 'pass', grade),
                    }
                  }),
                },
                // Pass → next beat
                {
                  guard: ({ context, event }) => {
                    if (event.type !== 'RESPOND') return false
                    const grade = runGrader(context, event.transcript, event.confidence)
                    return effectivelyPassed(grade)
                  },
                  target: 'gate',
                  actions: assign(({ context, event }) => {
                    if (event.type !== 'RESPOND') return {}
                    const grade = runGrader(context, event.transcript, event.confidence)
                    return {
                      beatIndex: context.beatIndex + 1,
                      retryCount: 0,
                      lastGradeResult: grade,
                      attempts: makeAttemptRecord(context, 'pass', grade),
                    }
                  }),
                },
                // Fail with retries remaining → re-speak the beat
                {
                  guard: ({ context, event }) => {
                    if (event.type !== 'RESPOND') return false
                    const grade = runGrader(context, event.transcript, event.confidence)
                    const beat = currentBeat(context)
                    return !effectivelyPassed(grade) && context.retryCount < (beat?.on_partial.max_retries ?? 2)
                  },
                  target: 'atc_speaking',
                  actions: assign(({ context, event }) => {
                    if (event.type !== 'RESPOND') return {}
                    const grade = runGrader(context, event.transcript, event.confidence)
                    return {
                      retryCount: context.retryCount + 1,
                      lastGradeResult: grade,
                      attempts: makeAttemptRecord(context, 'partial', grade),
                    }
                  }),
                },
                // Out of retries → scaffold
                {
                  target: '#scenario.scaffold',
                  actions: assign(({ context, event }) => {
                    if (event.type !== 'RESPOND') return {}
                    const grade = runGrader(context, event.transcript, event.confidence)
                    return {
                      retryCount: 0,
                      lastGradeResult: grade,
                      attempts: makeAttemptRecord(context, 'fail', grade),
                    }
                  }),
                },
              ],
            },
          },
        },
      },

      scaffold: {
        on: {
          SCAFFOLD_PASS: [
            {
              guard: ({ context }) => isLastBeat(context),
              target: 'debrief',
              actions: assign({
                attempts: ({ context }) => makeAttemptRecord(context, 'scaffold', context.lastGradeResult),
              }),
            },
            {
              target: 'tuning_or_speaking',
              actions: assign({
                beatIndex: ({ context }) => context.beatIndex + 1,
                retryCount: 0,
                attempts: ({ context }) => makeAttemptRecord(context, 'scaffold', context.lastGradeResult),
              }),
            },
          ],
        },
      },

      debrief: {
        type: 'final',
      },
    },
  },
)
