export type AttemptResult = 'pass' | 'partial' | 'fail' | 'scaffold' | 'say_again'

export interface SlotMatch {
  slot: string
  expected: string
  found: string | null
  matched: boolean
  criticality: 'critical' | 'standard'
}

export interface GradeResult {
  passed: boolean
  missingCritical: string[]
  missingStandard: string[]
  slotMatches: SlotMatch[]
  confidence: number
  rawTranscript: string
  normalizedTranscript: string
}

export interface AttemptRecord {
  beatId: string
  skillTag: string
  result: AttemptResult
  gradeResult: GradeResult | null
  timestamp: number
}
