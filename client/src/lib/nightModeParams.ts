/**
 * NightMode processor parameters exposed in the UI. Ranges match what
 * AstraCamillaDsp's `validate_night_mode` accepts; a slider that went further would
 * produce configs the DSP rejects. Defaults match the DSP's own.
 */

export type NightModeParamKey =
  | 'amount'
  | 'max_attenuation'
  | 'bass_reduction'
  | 'bass_frequency'
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
    max: 30,
    defaultValue: 4,
    help:
      'Depth of a bass shelf below the bass frequency. It deepens with the amount of ' +
      'gain reduction night mode is applying and reaches full depth at 12 dB of reduction.',
    effect:
      'Higher: less low end in loud scenes, which is what carries through walls and ' +
      'floors. Lower: loud scenes keep their weight. Quiet scenes with no reduction ' +
      'are not changed. 0 turns the shelf off.',
  },
  {
    key: 'bass_frequency',
    label: 'Bass frequency',
    unit: ' Hz',
    min: 60,
    max: 300,
    defaultValue: 120,
    help: 'The corner frequency of the bass shelf: the bass reduction applies below it.',
    effect:
      'Higher: the shelf reaches further up into the low mids. Lower: only the deepest ' +
      'bass is reduced.',
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

/**
 * The dialogue reference normally adapts toward whatever the detector judges as
 * dialogue, which is what lets one setup work across a quiet drama and a loud
 * blockbuster. That adapting is also what caps how much reduction ever happens: on
 * louder content the reference chases upward and narrows the gap to the threshold,
 * so no amount of ratio/max_attenuation buys much more (measured: 11.8 dB -> 14.3 dB
 * reduction on a trailer's loudest 10s going from defaults to every other knob maxed).
 * Pinning the reference removes that ceiling — same test, pinned at -38 dBFS, gave
 * 31 dB. The trade-off: a pin doesn't adapt to this content's actual dialogue level,
 * so it can compress quiet dialogue too, not just the loud parts.
 */
export const REFERENCE_LEVEL_MIN = -100;
export const REFERENCE_LEVEL_MAX = -12;
export const REFERENCE_LEVEL_DEFAULT_PIN = -33;

/**
 * Bounds for the adaptive reference: it is clamped into [reference_min, reference_max]
 * and follows the dialogue level at `reference_slew` dB/s. A pinned reference
 * (`reference_level`) ignores all three. Ranges match AstraCamillaDsp's
 * `validate_night_mode`; min must not exceed max.
 */
export const REFERENCE_MIN_DEFAULT = -100;
export const REFERENCE_MAX_DEFAULT = -12;
export const REFERENCE_SLEW_MIN = 0.05;
export const REFERENCE_SLEW_MAX = 3;
export const REFERENCE_SLEW_DEFAULT = 0.25;
export const REFERENCE_SLEW_STEP = 0.05;

export type ReferenceBoundKey = 'reference_max' | 'reference_min' | 'reference_slew';

export interface ReferenceBoundSpec {
  key: ReferenceBoundKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  defaultValue: number;
  help: string;
  effect: string;
}

export const REFERENCE_BOUND_PARAMS: ReferenceBoundSpec[] = [
  {
    key: 'reference_max',
    label: 'Reference max (never go above)',
    unit: ' dBFS',
    min: REFERENCE_LEVEL_MIN,
    max: REFERENCE_LEVEL_MAX,
    defaultValue: REFERENCE_MAX_DEFAULT,
    help: 'The highest level the adaptive reference may reach, however loud the dialogue gets.',
    effect:
      'The threshold is the reference plus headroom. Lower: the threshold stays lower, so ' +
      'louder passages are reduced more. Higher: the reference follows louder dialogue further.',
  },
  {
    key: 'reference_min',
    label: 'Reference min (never go below)',
    unit: ' dBFS',
    min: REFERENCE_LEVEL_MIN,
    max: REFERENCE_LEVEL_MAX,
    defaultValue: REFERENCE_MIN_DEFAULT,
    help: 'The lowest level the adaptive reference may reach, however quiet the dialogue gets.',
    effect:
      'The threshold is the reference plus headroom. Higher: the threshold cannot drop in ' +
      'quiet scenes. Lower: the reference follows quieter dialogue further. It cannot go ' +
      'above the max.',
  },
  {
    key: 'reference_slew',
    label: 'Follow speed',
    unit: ' dB/s',
    min: REFERENCE_SLEW_MIN,
    max: REFERENCE_SLEW_MAX,
    defaultValue: REFERENCE_SLEW_DEFAULT,
    help: 'How fast the reference moves toward the current dialogue level, in dB per second.',
    effect:
      'Higher: it adapts quickly to a change of scene or volume. Lower: it moves slowly ' +
      'and stays steadier through short loud or quiet moments.',
  },
];

export interface ReferenceBoundRow {
  spec: ReferenceBoundSpec;
  value: number;
}

/**
 * Slider rows for the adaptive reference bounds: empty while the reference is
 * pinned, since a pin overrides them. Built from the processor parameters in one
 * call so the page re-evaluates it whenever they change.
 */
export function referenceBoundRows(parameters: Record<string, unknown>): ReferenceBoundRow[] {
  const pinned = parameters.reference_level ?? null;
  if (pinned !== null) return [];
  return REFERENCE_BOUND_PARAMS.map((spec) => {
    const raw = parameters[spec.key];
    return { spec, value: raw === null || raw === undefined ? spec.defaultValue : Number(raw) };
  });
}

export const BASS_FREQUENCY_STEP = 5;
