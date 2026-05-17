import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Rect, Line, Circle, Text as SvgText, G } from 'react-native-svg'
import type { ContentPack } from '@/types/content'

interface Props {
  pack: ContentPack
  beatId?: string
}

const C = {
  bg:      '#0B0F1E',
  runway:  '#2A3550',
  taxiway: '#1C2548',
  ramp:    '#161E38',
  line:    '#1C2548',
  label:   '#5A6B94',
  accent:  '#6FE3FF',
}

// SVG canvas center and runway half-length (in SVG units)
const CX = 160, CY = 90, HALF_RWY = 72

// Phase → [t, lateral]
// t: 0 = low-numbered runway end, 1 = high-numbered end
// lateral: perpendicular offset in units of HALF_RWY (positive = left of heading direction)
const PHASE_POS: Record<string, [number, number]> = {
  LISTEN_ATIS:       [-0.05,  0.8],
  TAXI_REQUEST:      [-0.05,  0.8],
  TAXI:              [ 0.10,  0.7],
  RUNUP_HOLD:        [ 0.02,  0.35],
  TAKEOFF_CLEARANCE: [ 0.15,  0.0],
  DEPARTURE:         [-0.55,  0.0],
  PRACTICE_AREA:     [-1.1,  -0.5],
  RETURN_INBOUND:    [ 1.4,   0.15],
  PATTERN_ENTRY:     [ 0.5,  -1.2],
  LANDING_CLEARANCE: [ 1.25,  0.15],
  TAXI_TO_PARKING:   [ 0.10,  0.7],
  // Arrival phases
  APPROACH_CALL:     [ 2.2,   0.0],
  SQUAWK_ASSIGN:     [ 1.8,   0.05],
  APPROACH_HANDOFF:  [ 1.5,   0.1],
  TOWER_CALL:        [ 0.5,  -1.2],
  CLEAR_OF_RUNWAY:   [ 0.05,  0.3],
  // CTAF phases
  CTAF_ENROUTE:      [ 2.2,   0.0],
  CTAF_DOWNWIND:     [ 0.5,  -1.2],
  CTAF_BASE:         [ 1.25,  0.15],
  CTAF_FINAL:        [ 1.5,   0.05],
  CTAF_CLEAR:        [ 0.05,  0.3],
}

const PHASE_LABELS: Record<string, string> = {
  LISTEN_ATIS: 'Ramp', TAXI_REQUEST: 'Ramp', TAXI: 'Taxiway',
  RUNUP_HOLD: 'Runup', TAKEOFF_CLEARANCE: 'Takeoff', DEPARTURE: 'Airborne',
  PRACTICE_AREA: 'Prac Area', RETURN_INBOUND: 'Inbound',
  PATTERN_ENTRY: 'Downwind', LANDING_CLEARANCE: 'Final', TAXI_TO_PARKING: 'Taxiway',
  // Arrival
  APPROACH_CALL: '10 mi out', SQUAWK_ASSIGN: 'Squawk', APPROACH_HANDOFF: 'Handoff',
  TOWER_CALL: 'Downwind', CLEAR_OF_RUNWAY: 'Clear',
  // CTAF
  CTAF_ENROUTE: '10 mi out', CTAF_DOWNWIND: 'Downwind', CTAF_BASE: 'Base',
  CTAF_FINAL: 'Final', CTAF_CLEAR: 'Clear',
}

function parseRunwayNum(id: string): number {
  const n = parseInt(id.replace(/[LRC]$/, ''), 10)
  return isNaN(n) ? 18 : n
}

// Group flat runway end list into physical runway pairs.
// ['13','31'] → [{lo:'13',hi:'31'}]
// ['13L','31R','13R','31L'] → [{lo:'13L',hi:'31R'},{lo:'13R',hi:'31L'}]
function physicalRunways(ids: string[]): Array<{ lo: string; hi: string }> {
  const entries = ids
    .map(id => ({ id, num: parseRunwayNum(id) }))
    .filter(e => e.num >= 1 && e.num <= 36)
  const seen = new Set<string>()
  const result: Array<{ lo: string; hi: string }> = []

  for (const r of entries) {
    if (seen.has(r.id)) continue
    const recipNum = r.num <= 18 ? r.num + 18 : r.num - 18
    const suf = r.id.match(/[LRC]$/)?.[0] ?? ''
    const recipSuf = suf === 'L' ? 'R' : suf === 'R' ? 'L' : suf
    const recip = entries.find(
      x => !seen.has(x.id) && x.id !== r.id && x.num === recipNum &&
        (x.id.match(/[LRC]$/)?.[0] ?? '') === recipSuf,
    )
    seen.add(r.id)
    if (recip) seen.add(recip.id)
    const loId = r.num < recipNum ? r.id : (recip?.id ?? String(recipNum).padStart(2, '0'))
    const hiId = r.num < recipNum ? (recip?.id ?? String(recipNum).padStart(2, '0')) : r.id
    result.push({ lo: loId, hi: hiId })
  }
  return result
}

// Heading (magnetic degrees) → unit vector in SVG coords
// SVG: x+ = right, y+ = down. Heading 0°=N(up) = SVG angle -90°.
function headingDir(heading: number): { cos: number; sin: number } {
  const rad = ((heading - 90) * Math.PI) / 180
  return { cos: Math.cos(rad), sin: Math.sin(rad) }
}

// Project runway-local coords (t, lateral) to SVG screen coords.
// t=0 → lo end, t=1 → hi end. lateral: positive = left of heading direction.
function project(
  t: number,
  lateral: number,
  dir: { cos: number; sin: number },
): { x: number; y: number } {
  const along = (t - 0.5) * 2 * HALF_RWY
  const perp = lateral * HALF_RWY * 0.2
  return {
    x: CX + along * dir.cos - perp * dir.sin,
    y: CY + along * dir.sin + perp * dir.cos,
  }
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export function AirportDiagram({ pack, beatId }: Props) {
  const runwayIds = pack.runways?.length ? pack.runways : ['31', '13']
  const physical = physicalRunways(runwayIds)
  const primary = physical[0] ?? { lo: '13', hi: '31' }
  const primaryDir = headingDir(parseRunwayNum(primary.lo) * 10)

  // Resolve position marker from beat phase
  const beat = pack.beats.find(b => b.id === beatId)
  const phase = beat?.phase ?? null
  const phasePos = phase ? PHASE_POS[phase] : null
  let marker: { x: number; y: number } | null = null
  if (phasePos) {
    const raw = project(phasePos[0], phasePos[1], primaryDir)
    marker = { x: clamp(raw.x, 10, 310), y: clamp(raw.y, 10, 170) }
  }

  return (
    <View style={styles.container}>
    <Text style={styles.icaoLabel}>{pack.airport_icao}</Text>
    <Svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet">
      <Rect x="0" y="0" width="320" height="180" fill={C.bg} />

      {/* Draw each physical runway */}
      {physical.map(({ lo, hi }, i) => {
        const loNum = parseRunwayNum(lo)
        const dir = headingDir(loNum * 10)
        // Offset parallel runways (same heading) perpendicular to runway direction
        const parallelOff = i * 16
        const ox = -dir.sin * parallelOff
        const oy =  dir.cos * parallelOff

        const x1 = CX - dir.cos * HALF_RWY + ox
        const y1 = CY - dir.sin * HALF_RWY + oy
        const x2 = CX + dir.cos * HALF_RWY + ox
        const y2 = CY + dir.sin * HALF_RWY + oy

        // Taxiway parallel to runway, offset to the left of heading
        const twyOff = 14
        const tx1 = x1 - dir.sin * twyOff, ty1 = y1 + dir.cos * twyOff
        const tx2 = x2 - dir.sin * twyOff, ty2 = y2 + dir.cos * twyOff

        // Labels beyond runway ends
        const ext = 12
        const lx = clamp(x1 - dir.cos * ext + ox, 10, 310)
        const ly = clamp(y1 - dir.sin * ext + oy, 10, 170)
        const hx = clamp(x2 + dir.cos * ext + ox, 10, 310)
        const hy = clamp(y2 + dir.sin * ext + oy, 10, 170)

        return (
          <G key={lo}>
            <Line x1={tx1} y1={ty1} x2={tx2} y2={ty2}
              stroke={C.taxiway} strokeWidth="5" strokeLinecap="square" />
            <Line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={C.runway} strokeWidth="10" strokeLinecap="square" />
            <Line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#2E3F60" strokeWidth="1.5" strokeDasharray="8 6" />
            <SvgText x={lx} y={ly} fill={C.label} fontSize="9"
              fontFamily="monospace" textAnchor="middle">{lo}</SvgText>
            <SvgText x={hx} y={hy} fill={C.label} fontSize="9"
              fontFamily="monospace" textAnchor="middle">{hi}</SvgText>
          </G>
        )
      })}

      {/* Airport boundary */}
      <Rect x="1" y="1" width="318" height="178" rx="4"
        fill="none" stroke={C.line} strokeWidth="1" strokeDasharray="4 4" />

      {/* Phase position marker */}
      {marker && (
        <G>
          <Circle cx={marker.x} cy={marker.y} r="10"
            fill="none" stroke={C.accent} strokeWidth="1" opacity="0.3" />
          <Circle cx={marker.x} cy={marker.y} r="6"
            fill="none" stroke={C.accent} strokeWidth="1" opacity="0.6" />
          <Circle cx={marker.x} cy={marker.y} r="3.5" fill={C.accent} />
          {phase && (
            <SvgText x={marker.x} y={marker.y - 13}
              fill={C.accent} fontSize="7" fontFamily="monospace"
              textAnchor="middle" fontWeight="bold">
              {PHASE_LABELS[phase] ?? phase}
            </SvgText>
          )}
        </G>
      )}
    </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  icaoLabel: {
    position: 'absolute',
    top: 4,
    right: 8,
    color: '#5A6B94',
    fontSize: 8,
    fontFamily: 'monospace',
    zIndex: 1,
  },
})
