import { act, renderHook } from '@testing-library/react-native'
import { useDrillStore } from '../drillStore'

const ALL_IDS = ['a', 'b', 'c', 'd']

beforeEach(() => {
  useDrillStore.setState({
    mode: 'full',
    selectedBeatIds: [],
  })
})

describe('drillStore', () => {
  it('toggleBeat adds an id when not present', () => {
    const { result } = renderHook(() => useDrillStore())
    act(() => result.current.toggleBeat('a'))
    expect(result.current.selectedBeatIds).toEqual(['a'])
  })

  it('toggleBeat removes an id when already present', () => {
    useDrillStore.setState({ selectedBeatIds: ['a', 'b'] })
    const { result } = renderHook(() => useDrillStore())
    act(() => result.current.toggleBeat('a'))
    expect(result.current.selectedBeatIds).toEqual(['b'])
  })

  it('selectAll sets all provided ids', () => {
    const { result } = renderHook(() => useDrillStore())
    act(() => result.current.selectAll(ALL_IDS))
    expect(result.current.selectedBeatIds).toEqual(ALL_IDS)
  })

  it('clearAll empties selectedBeatIds', () => {
    useDrillStore.setState({ selectedBeatIds: ALL_IDS })
    const { result } = renderHook(() => useDrillStore())
    act(() => result.current.clearAll())
    expect(result.current.selectedBeatIds).toEqual([])
  })

  it('default mode is full', () => {
    const { result } = renderHook(() => useDrillStore())
    expect(result.current.mode).toBe('full')
  })

  it('setMode changes mode', () => {
    const { result } = renderHook(() => useDrillStore())
    act(() => result.current.setMode('drill'))
    expect(result.current.mode).toBe('drill')
  })
})
