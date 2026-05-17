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
 *  garbled/empty utterance from advancing a beat whose slots are all marked `standard`. */
function effectivelyPassed(grade: GradeResult | null): boolean {
  if (!grade) return false
  return grade.passed && grade.slotMatches.some(m => m.matched)
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
          START: {
            target: 'preflight',
            actions: assign({
              pack: ({ event }) => event.pack,
              scenarioContext: ({ event }) => event.scenarioContext,
              beatIndex: 0,
              retryCount: 0,
              attempts: [],
              lastGradeResult: null,
            }),
          },
        },
      },

      preflight: {
        on: {
          CONFIRM: { target: 'atc_speaking' },
        },
      },

      atc_speaking: {
        on: {
          ATC_DONE: { target: 'awaiting_response' },
        },
      },

      awaiting_response: {
        on: {
          SAY_AGAIN: { target: 'atc_speaking' },
          SHOW_TILES: { target: 'scaffold' },
          RESPOND: [
            // Passed + last beat → debrief
            {
              guard: ({ context, event }) => {
                if (event.type !== 'RESPOND') return false
                const grade = runGrader(context, event.transcript, event.confidence)
                return effectivelyPassed(grade) && isLastBeat(context)
              },
              target: 'debrief',
              actions: assign(({ context, event }) => {
                if (event.type !== 'RESPOND') return {}
                const grade = runGrader(context, event.transcript, event.confidence)
                return {
                  lastGradeResult: grade,
                  attempts: makeAttemptRecord(context, 'pass', grade),
                }
              }),
            },
            // Passed → next beat
            {
              guard: ({ context, event }) => {
                if (event.type !== 'RESPOND') return false
                const grade = runGrader(context, event.transcript, event.confidence)
                return effectivelyPassed(grade)
              },
              target: 'atc_speaking',
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
            // Failed, retries remaining → retry
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
            // Failed, no retries → scaffold
            {
              target: 'scaffold',
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

      scaffold: {
        on: {
          SCAFFOLD_PASS: [
            // Last beat → debrief
            {
              guard: ({ context }) => isLastBeat(context),
              target: 'debrief',
              actions: assign(({ context }) => ({
                attempts: makeAttemptRecord(context, 'scaffold', null),
              })),
            },
            // Not last beat → advance
            {
              target: 'atc_speaking',
              actions: assign(({ context }) => ({
                beatIndex: context.beatIndex + 1,
                retryCount: 0,
                attempts: makeAttemptRecord(context, 'scaffold', null),
              })),
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
