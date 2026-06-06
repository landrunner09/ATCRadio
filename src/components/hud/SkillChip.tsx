import { View, Text } from 'react-native'
import type { Beat } from '@/types/content'

export type SkillChipStatus =
  | 'tune_atis' | 'tap_listen' | 'listening'
  | 'tune_radio' | 'pilot_call'
  | 'atc_speaking' | 'grading'

interface SkillChipProps {
  beat: Beat
  status: SkillChipStatus
}

const STATUS_LABEL: Record<SkillChipStatus, string> = {
  tune_atis: '📻 Tune to ATIS',
  tap_listen: '📻 Tap to Listen',
  listening: '📻 Listening…',
  tune_radio: '📡 Tune Radio',
  pilot_call: '🎙 Your Call',
  atc_speaking: '📣 ATC Speaking',
  grading: 'Now Grading',
}

export function SkillChip({ beat, status }: SkillChipProps) {
  return (
    <View className="mx-5 mb-3 px-3 py-2 bg-surface2 rounded-xl border border-line flex-row justify-between items-center">
      <Text className="text-muted text-xs uppercase tracking-widest">
        {STATUS_LABEL[status]}
      </Text>
      <Text className="text-accent text-xs font-semibold">
        {beat.skill_tag.replace(/_/g, ' ').toUpperCase()}
      </Text>
    </View>
  )
}
