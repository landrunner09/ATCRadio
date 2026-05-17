import { createActor } from 'xstate'
import { scenarioMachine } from '@/engine/machine'
import KPAO from '@/content/KPAO.json'
import { generateScenarioContext } from '@/engine/context'
import { loadPack } from '@/engine/loader'

const pack = loadPack(KPAO)
const ctx = generateScenarioContext(undefined, {
  callsign: 'N12345',
  runway_in_use: '31',
  atis_letter: 'Bravo',
  departure_taxiway: 'alpha',
})

function startActor() {
  const actor = createActor(scenarioMachine)
  actor.start()
  return actor
}

describe('scenarioMachine', () => {
  test('starts in idle state', () => {
    const actor = startActor()
    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })

  test('transitions to preflight on START', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    expect(actor.getSnapshot().value).toBe('preflight')
    actor.stop()
  })

  test('transitions to atc_speaking on CONFIRM', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    expect(actor.getSnapshot().value).toBe('atc_speaking')
    actor.stop()
  })

  test('transitions to awaiting_response on ATC_DONE', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    expect(actor.getSnapshot().value).toBe('awaiting_response')
    actor.stop()
  })

  test('advances beat on correct RESPOND', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    // ATIS beat: respond with atis letter, runway, altimeter (all standard slots)
    actor.send({
      type: 'RESPOND',
      transcript: 'information bravo runway thirty one altimeter thirty zero two',
      confidence: 0.95,
    })
    expect(actor.getSnapshot().value).toBe('atc_speaking')
    expect(actor.getSnapshot().context.beatIndex).toBe(1)
    actor.stop()
  })

  test('goes to scaffold after max retries', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    // Send wrong response 3 times (max_retries is 2, so 3rd fail = scaffold)
    for (let i = 0; i < 3; i++) {
      if (actor.getSnapshot().value === 'scaffold') break
      actor.send({ type: 'RESPOND', transcript: 'uh...', confidence: 0.95 })
      if (actor.getSnapshot().value !== 'scaffold') {
        actor.send({ type: 'ATC_DONE' })
      }
    }
    expect(actor.getSnapshot().value).toBe('scaffold')
    actor.stop()
  })

  test('SAY_AGAIN goes back to atc_speaking', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    actor.send({ type: 'SAY_AGAIN' })
    expect(actor.getSnapshot().value).toBe('atc_speaking')
    actor.stop()
  })

  test('SCAFFOLD_PASS advances beat', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    actor.send({ type: 'SHOW_TILES' })
    expect(actor.getSnapshot().value).toBe('scaffold')
    actor.send({ type: 'SCAFFOLD_PASS' })
    expect(actor.getSnapshot().value).toBe('atc_speaking')
    expect(actor.getSnapshot().context.beatIndex).toBe(1)
    actor.stop()
  })

  test('reaches debrief after last beat passes', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    // Use scaffold to fast-forward through all beats
    for (let i = 0; i < pack.beats.length; i++) {
      actor.send({ type: 'ATC_DONE' })
      actor.send({ type: 'SHOW_TILES' })
      actor.send({ type: 'SCAFFOLD_PASS' })
    }
    expect(actor.getSnapshot().value).toBe('debrief')
    actor.stop()
  })
})
