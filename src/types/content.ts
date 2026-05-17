export type SlotCriticality = 'critical' | 'standard'

export interface SlotDefinition {
  slot: string
  value: string
  criticality: SlotCriticality
}

export interface BeatResponse {
  type: 'readback' | 'pilot_initiated'
  required_slots: SlotDefinition[]
  phraseology_hints?: string[]
}

export interface BeatOnPartial {
  missing_critical: string[]
  controller_correction: string
  retry_same_beat: boolean
  max_retries: number
}

export interface BeatOnFail {
  scaffold_mode: true
  next_after_scaffold_pass: string
}

export interface Beat {
  id: string
  phase: string
  skill_tag: string
  /** 'readback' (default) or 'pilot_initiated' — HUD skips TTS for pilot_initiated */
  type?: 'readback' | 'pilot_initiated'
  /** Shown as a cue card in the HUD when type === 'pilot_initiated' */
  cue_text?: string
  speaker: 'tower' | 'approach' | 'ground' | 'atis'
  voice_role: string
  line_template: string
  line_variants?: string[]
  expected_student_response: BeatResponse
  on_pass: { next: string | '__debrief__' }
  on_partial: BeatOnPartial
  on_fail_after_retries: BeatOnFail
  on_say_again: { replay_audio: true }
}

export interface ControllerVoiceIds {
  [role: string]: string
}

export interface ScenarioContext {
  callsign: string
  aircraft_type: string
  runway_in_use: string
  weather: {
    wind: string
    vis: string
    altimeter: string
  }
  atis_letter: string
  departure_taxiway: string
  destination: string
  controller_voice_ids: ControllerVoiceIds
  /** 4-digit octal squawk code assigned by approach (e.g. "4721"). Empty string for CTAF. */
  squawk_code: string
  /** Approach facility name for cue text (e.g. "NorCal Approach"). */
  approach_facility: string
}

export interface ContentPack {
  airport_icao: string
  airport_name: string
  city: string
  tower_freq: string
  approach_freq: string
  atis_freq: string
  /** 'departure' or 'arrival'. Defaults to 'departure' for built-in packs. */
  scenario_type: 'departure' | 'arrival'
  /** true = tower-controlled, false = CTAF/uncontrolled. Defaults to true. */
  controlled: boolean
  /** CTAF frequency for uncontrolled airports (e.g. "122.8"). */
  ctaf_freq?: string
  pattern_altitude_ft: number
  beats: Beat[]
  scenario_name: string
  scenario_description: string
  estimated_duration_min: number
  runways?: string[]
  taxiways?: string[]
}
