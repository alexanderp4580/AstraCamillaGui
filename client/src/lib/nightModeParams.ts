/**
 * NightMode processor parameters exposed in the UI. Ranges match what
 * AstraCamillaDsp's `validate_night_mode` accepts; a slider that went further would
 * produce configs the DSP rejects. Defaults match the DSP's own.
 */

export type NightModeParamKey =
  | 'amount'
  | 'max_attenuation'
  | 'bass_reduction'
  | 'headroom'
  | 'ratio'
  | 'transient_softening'
  | 'dialogue_protection'
  | 'presence_gain';

export interface NightModeParamSpec {
  key: NightModeParamKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  defaultValue: number;
  help: string;
}

export const NIGHT_MODE_PARAMS: NightModeParamSpec[] = [
  {
    key: 'amount',
    label: 'Amount',
    unit: '%',
    min: 0,
    max: 100,
    defaultValue: 100,
    help: 'Scales every reduction. 0 passes audio through untouched.',
  },
  {
    key: 'max_attenuation',
    label: 'Max Attenuation',
    unit: ' dB',
    min: 0,
    max: 60,
    defaultValue: 28,
    help: 'Hard limit on total reduction. Lower keeps more impact.',
  },
  {
    key: 'headroom',
    label: 'Headroom',
    unit: ' dB',
    min: 0,
    max: 24,
    defaultValue: 0,
    help: 'How far above dialogue level reduction starts. Raise if too eager.',
  },
  {
    key: 'ratio',
    label: 'Ratio',
    unit: ':1',
    min: 1,
    max: 20,
    defaultValue: 12,
    help: 'Compression ratio of the slow stage.',
  },
  {
    key: 'transient_softening',
    label: 'Transient Softening',
    unit: '%',
    min: 0,
    max: 100,
    defaultValue: 100,
    help: 'Depth of the fast stage that catches sudden impacts.',
  },
  {
    key: 'dialogue_protection',
    label: 'Dialogue Protection',
    unit: '%',
    min: 0,
    max: 100,
    defaultValue: 60,
    help: 'How strongly detected dialogue is spared. 0 turns the detector off.',
  },
  {
    key: 'bass_reduction',
    label: 'Bass Reduction',
    unit: ' dB',
    min: 0,
    max: 10,
    defaultValue: 10,
    help: 'Extra low-end cut while reducing. Bass carries through walls.',
  },
  {
    key: 'presence_gain',
    label: 'Presence Gain',
    unit: ' dB',
    min: 0,
    max: 6,
    defaultValue: 0,
    help: 'Boost around 2.5 kHz on dialogue, for intelligibility at low volume.',
  },
];

export function getNightModeParamSpec(key: string): NightModeParamSpec | undefined {
  return NIGHT_MODE_PARAMS.find((p) => p.key === key);
}
