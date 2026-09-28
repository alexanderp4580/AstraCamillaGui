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
  /** What the control does. */
  help: string;
  /** What turning it up or down sounds like. */
  effect: string;
}

export const NIGHT_MODE_PARAMS: NightModeParamSpec[] = [
  {
    key: 'amount',
    label: 'Amount',
    unit: '%',
    min: 0,
    max: 100,
    defaultValue: 100,
    help:
      'Master strength of night mode. Every reduction it makes is scaled by this, ' +
      'so 50% gives half as many dB of reduction as 100%.',
    effect:
      'Higher: loud scenes are pulled down more. Lower: more of the original dynamics ' +
      'come through. At 0% audio passes through untouched, handy for comparing with ' +
      'night mode off.',
  },
  {
    key: 'max_attenuation',
    label: 'Max Attenuation',
    unit: ' dB',
    min: 0,
    max: 60,
    defaultValue: 28,
    help: 'The most night mode may ever turn anything down, however loud it gets.',
    effect:
      'Lower: explosions and music keep more punch, but the loudest moments stay ' +
      'louder. Higher: the loudest moments are tamed further, at the risk of sounding ' +
      'flat. 20 to 30 dB suits most films.',
  },
  {
    key: 'headroom',
    label: 'Headroom',
    unit: ' dB',
    min: 0,
    max: 24,
    defaultValue: 0,
    help:
      'How far above the dialogue level sound may get before night mode starts ' +
      'reducing it. The dialogue level is tracked automatically, so this follows ' +
      'the TV volume rather than being a fixed level.',
    effect:
      '0: anything louder than speech is reduced. Higher: moderately loud sounds pass ' +
      'untouched and only big peaks are reduced. Raise it if night mode feels too ' +
      'eager or music sounds squashed.',
  },
  {
    key: 'ratio',
    label: 'Ratio',
    unit: ':1',
    min: 1,
    max: 20,
    defaultValue: 12,
    help:
      'How hard sound above the threshold is pushed down. At 4:1, every 4 dB a sound ' +
      'rises above the threshold comes out as 1 dB.',
    effect:
      'Higher: loud passages end up close to dialogue level, very even but less ' +
      'exciting. Lower: gentler, loud scenes still feel loud, just less so.',
  },
  {
    key: 'transient_softening',
    label: 'Transient Softening',
    unit: '%',
    min: 0,
    max: 100,
    defaultValue: 100,
    help:
      'Strength of a second, fast stage that catches sudden hits such as gunshots, ' +
      'door slams and the first instant of an explosion, which the main stage is ' +
      'too slow to catch.',
    effect:
      'Higher: sudden bangs are blunted and less likely to startle. Lower: impacts ' +
      'keep their sharp attack. 0 turns the fast stage off.',
  },
  {
    key: 'dialogue_protection',
    label: 'Dialogue Protection',
    unit: '%',
    min: 0,
    max: 100,
    defaultValue: 60,
    help:
      'How much night mode holds back while someone is talking. Speech is recognised ' +
      'as sound that is centred, in the voice range, and rising and falling at ' +
      'syllable speed.',
    effect:
      'Higher: voices stay more untouched, but loud centred music can slip through ' +
      'too. Lower: more even reduction on everything. 0 turns the speech detector ' +
      'off and night mode becomes a plain leveller.',
  },
  {
    key: 'bass_reduction',
    label: 'Bass Reduction',
    unit: ' dB',
    min: 0,
    max: 10,
    defaultValue: 10,
    help:
      'Extra cut below about 120 Hz, applied only while night mode is actively ' +
      'turning something down. Quiet scenes keep their full tone.',
    effect:
      'Higher: less rumble in loud scenes, which is what carries through walls and ' +
      'floors. Lower: loud scenes keep their weight.',
  },
  {
    key: 'presence_gain',
    label: 'Presence Gain',
    unit: ' dB',
    min: 0,
    max: 6,
    defaultValue: 0,
    help:
      'A boost around 2.5 kHz, the range that makes consonants clear, applied only ' +
      'while dialogue is detected.',
    effect:
      'Higher: speech is easier to follow at very low volume, but voices sound ' +
      'slightly brighter. 0 turns it off.',
  },
];

export function getNightModeParamSpec(key: string): NightModeParamSpec | undefined {
  return NIGHT_MODE_PARAMS.find((p) => p.key === key);
}
