import React from 'react'
import { render } from '@testing-library/react-native'
import { AirportDiagram } from '../AirportDiagram'
import type { ContentPack } from '@/types/content'

const MOCK_PACK: Pick<ContentPack, 'airport_icao' | 'runways' | 'beats'> = {
  airport_icao: 'KGNV',
  runways: ['07', '25', '11', '29'],
  beats: [
    {
      id: 'kgnv.taxi.clearance',
      phase: 'TAXI',
      skill_tag: 'taxi_readback',
      speaker: 'tower',
      voice_role: 'kgnv_tower',
      line_template: '',
      expected_student_response: { type: 'readback', required_slots: [] },
      on_pass: { next: 'kgnv.runup.ready' },
      on_partial: { missing_critical: [], controller_correction: '', retry_same_beat: true, max_retries: 2 },
      on_fail_after_retries: { scaffold_mode: true, next_after_scaffold_pass: 'kgnv.runup.ready' },
      on_say_again: { replay_audio: true },
    },
  ],
}

test('renders without crashing for any airport', () => {
  const { toJSON } = render(
    <AirportDiagram pack={MOCK_PACK as ContentPack} beatId="kgnv.taxi.clearance" />
  )
  expect(toJSON()).toBeTruthy()
})

test('renders ICAO label from pack', () => {
  const { getByText } = render(
    <AirportDiagram pack={MOCK_PACK as ContentPack} />
  )
  expect(getByText('KGNV')).toBeTruthy()
})

test('renders without beatId (no marker)', () => {
  const { toJSON } = render(
    <AirportDiagram pack={MOCK_PACK as ContentPack} />
  )
  expect(toJSON()).toBeTruthy()
})
