import { RadioTuner } from '@/components/RadioTuner'

interface TunerCardProps {
  targetFreq: string
  targetLabel: string
  startFreq: string
  onConfirmed: (freq: string) => void
}

/** Thin wrapper around RadioTuner — gives the HUD a single mount point. */
export function TunerCard(props: TunerCardProps) {
  return <RadioTuner {...props} />
}
