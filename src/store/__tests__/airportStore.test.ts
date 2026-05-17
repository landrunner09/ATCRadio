jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

import { useAirportStore } from '@/store/airportStore'
import type { ContentPack } from '@/types/content'

const mockPack = (icao: string, scenarioType: 'departure' | 'arrival' = 'departure'): ContentPack => ({
  airport_icao: icao,
  airport_name: `${icao} Airport`,
  city: 'Test City',
  tower_freq: '118.1',
  approach_freq: '124.0',
  atis_freq: '120.6',
  pattern_altitude_ft: 1000,
  scenario_type: scenarioType,
  controlled: true,
  beats: [],
  scenario_name: 'Test',
  scenario_description: 'Test',
  estimated_duration_min: 10,
})

beforeEach(() => {
  useAirportStore.setState({
    customPacks: {},
    arrivalPacks: {},
    selectedScenarioType: 'departure',
    isHydrated: false,
  })
})

test('addArrivalPack stores pack under ICAO key', () => {
  const pack = mockPack('KPAO', 'arrival')
  useAirportStore.getState().addArrivalPack(pack)
  expect(useAirportStore.getState().arrivalPacks['KPAO']).toBeDefined()
  expect(useAirportStore.getState().arrivalPacks['KPAO'].scenario_type).toBe('arrival')
})

test('removeArrivalPack deletes the pack', () => {
  useAirportStore.setState({ arrivalPacks: { KPAO: mockPack('KPAO', 'arrival') } })
  useAirportStore.getState().removeArrivalPack('KPAO')
  expect(useAirportStore.getState().arrivalPacks['KPAO']).toBeUndefined()
})

test('setSelectedScenarioType updates state', () => {
  useAirportStore.getState().setSelectedScenarioType('arrival')
  expect(useAirportStore.getState().selectedScenarioType).toBe('arrival')
})

test('removeCustomPack also removes arrival pack', () => {
  useAirportStore.setState({
    customPacks: { KGNV: mockPack('KGNV') },
    arrivalPacks: { KGNV: mockPack('KGNV', 'arrival') },
  })
  useAirportStore.getState().removeCustomPack('KGNV')
  expect(useAirportStore.getState().customPacks['KGNV']).toBeUndefined()
  expect(useAirportStore.getState().arrivalPacks['KGNV']).toBeUndefined()
})
