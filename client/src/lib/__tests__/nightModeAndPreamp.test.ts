import { describe, it, expect } from 'vitest';
import type { GuiReadyCamillaDSPConfig } from '../camillaDSP';
import { applyEqBandsToConfig, extractEqBandsFromConfig } from '../camillaEqMapping';
import { addNightMode, findNightMode } from '../nightModeEdit';
import { referenceBoundRows } from '../nightModeParams';
import { channelsAtPipelineIndex } from '../pipelineChannels';
import {
  setNightModeParam,
  setNightModeReferenceLevel,
  setNightModeReferenceMax,
  setNightModeReferenceMin,
  setNightModeReferenceSlew,
} from '../pipelineProcessorEdit';

// Mirrors the moOde box: 4 captured channels (mixbus + line-in) folded to 2.
function fourToTwoConfig(): GuiReadyCamillaDSPConfig {
  return {
    devices: {
      samplerate: 44100,
      chunksize: 1024,
      capture: { type: 'Alsa', channels: 4 },
      playback: { type: 'Alsa', channels: 2 },
    },
    filters: {
      EQ1: { type: 'Biquad', parameters: { type: 'Peaking', freq: 1000, q: 1, gain: 0 } },
    },
    mixers: {
      mix_down: {
        channels: { in: 4, out: 2 },
        mapping: [
          { dest: 0, sources: [{ channel: 0, gain: 0 }, { channel: 2, gain: 0 }] },
          { dest: 1, sources: [{ channel: 1, gain: 0 }, { channel: 3, gain: 0 }] },
        ],
      },
    },
    processors: {},
    pipeline: [
      { type: 'Mixer', name: 'mix_down' },
      { type: 'Filter', channels: [0, 1], names: ['EQ1'] },
    ],
  };
}

describe('channelsAtPipelineIndex', () => {
  it('follows mixers along the pipeline', () => {
    const config = fourToTwoConfig();
    expect(channelsAtPipelineIndex(config, 0)).toBe(4);
    expect(channelsAtPipelineIndex(config, 1)).toBe(2);
    expect(channelsAtPipelineIndex(config, 2)).toBe(2);
  });

  it('ignores bypassed mixers', () => {
    const config = fourToTwoConfig();
    config.pipeline[0].bypassed = true;
    expect(channelsAtPipelineIndex(config, 2)).toBe(4);
  });
});

describe('preamp placement', () => {
  it('goes after the downmix, sized to its output', () => {
    const config = fourToTwoConfig();
    const extracted = extractEqBandsFromConfig(config);
    const updated = applyEqBandsToConfig(config, { ...extracted, preampGain: -3 });

    expect(updated.pipeline.map((s: any) => s.name ?? s.type)).toEqual(['mix_down', 'preamp', 'Filter']);
    expect(updated.mixers!.preamp.channels).toEqual({ in: 2, out: 2 });
    expect(updated.mixers!.preamp.mapping.map((m: any) => m.sources[0].gain)).toEqual([-3, -3]);
  });

  it('updates an existing preamp in place, including back to 0 dB', () => {
    const config = fourToTwoConfig();
    const extracted = extractEqBandsFromConfig(config);
    const withPreamp = applyEqBandsToConfig(config, { ...extracted, preampGain: -3 });
    const reset = applyEqBandsToConfig(withPreamp, { ...extracted, preampGain: 0 });

    expect(reset.pipeline).toHaveLength(3);
    expect(reset.mixers!.preamp.mapping.map((m: any) => m.sources[0].gain)).toEqual([0, 0]);
  });
});

describe('night mode', () => {
  it('is added at the end, sized to the pipeline output', () => {
    const updated = addNightMode(fourToTwoConfig());
    const found = findNightMode(updated);

    expect(found).not.toBeNull();
    expect(found!.stepIndex).toBe(2);
    expect(found!.bypassed).toBe(false);
    expect(updated.processors[found!.name].parameters.channels).toBe(2);
  });

  it('is not found when absent', () => {
    expect(findNightMode(fourToTwoConfig())).toBeNull();
  });

  it('clamps to the ranges the DSP accepts', () => {
    const config = addNightMode(fourToTwoConfig());
    const name = findNightMode(config)!.name;

    const bass = setNightModeParam(config, name, 'bass_reduction', 24);
    expect(bass.processors[name].parameters.bass_reduction).toBe(10);

    const presenceHigh = setNightModeParam(config, name, 'presence_gain', 12);
    expect(presenceHigh.processors[name].parameters.presence_gain).toBe(6);

    const presenceLow = setNightModeParam(config, name, 'presence_gain', -12);
    expect(presenceLow.processors[name].parameters.presence_gain).toBe(0);
  });

  it('pins and unpins the reference, clamped to the DSP window', () => {
    const config = addNightMode(fourToTwoConfig());
    const name = findNightMode(config)!.name;

    const pinned = setNightModeReferenceLevel(config, name, -60);
    expect(pinned.processors[name].parameters.reference_level).toBe(-45);

    const pinnedHigh = setNightModeReferenceLevel(config, name, 0);
    expect(pinnedHigh.processors[name].parameters.reference_level).toBe(-12);

    const unpinned = setNightModeReferenceLevel(pinned, name, null);
    expect(unpinned.processors[name].parameters.reference_level).toBeNull();
  });
});

describe('night mode reference bounds', () => {
  function base() {
    const config = addNightMode(fourToTwoConfig());
    return { config, name: findNightMode(config)!.name };
  }
  const p = (c: GuiReadyCamillaDSPConfig, name: string) => c.processors[name].parameters as any;

  it('stores min, max and follow speed and leaves other params alone', () => {
    const { config, name } = base();
    const before = { ...p(config, name) };
    const a = setNightModeReferenceMax(config, name, -20);
    const b = setNightModeReferenceMin(a, name, -40);
    const c = setNightModeReferenceSlew(b, name, 1.5);
    expect(p(c, name).reference_max).toBe(-20);
    expect(p(c, name).reference_min).toBe(-40);
    expect(p(c, name).reference_slew).toBe(1.5);
    for (const k of Object.keys(before)) expect(p(c, name)[k]).toEqual(before[k]);
    expect(p(config, name).reference_max).toBeUndefined();
  });

  it('clamps to the DSP ranges', () => {
    const { config, name } = base();
    expect(p(setNightModeReferenceMax(config, name, 5), name).reference_max).toBeUndefined();
    expect(p(setNightModeReferenceMax(config, name, -90), name).reference_max).toBe(-45);
    expect(p(setNightModeReferenceMin(config, name, 5), name).reference_min).toBe(-12);
    expect(p(setNightModeReferenceMin(config, name, -90), name).reference_min).toBeUndefined();
    expect(p(setNightModeReferenceSlew(config, name, 0), name).reference_slew).toBe(0.05);
    expect(p(setNightModeReferenceSlew(config, name, 99), name).reference_slew).toBe(3);
  });

  it('rounds bounds to whole dB and follow speed to 0.05', () => {
    const { config, name } = base();
    expect(p(setNightModeReferenceMax(config, name, -20.4), name).reference_max).toBe(-20);
    expect(p(setNightModeReferenceSlew(config, name, 0.37), name).reference_slew).toBe(0.35);
  });

  it('raising min above max raises max to match', () => {
    const { config, name } = base();
    const c = setNightModeReferenceMin(setNightModeReferenceMax(config, name, -30), name, -20);
    expect(p(c, name).reference_min).toBe(-20);
    expect(p(c, name).reference_max).toBe(-20);
  });

  it('lowering max below min lowers min to match', () => {
    const { config, name } = base();
    const c = setNightModeReferenceMax(setNightModeReferenceMin(config, name, -25), name, -35);
    expect(p(c, name).reference_max).toBe(-35);
    expect(p(c, name).reference_min).toBe(-35);
  });

  it('allows min == max', () => {
    const { config, name } = base();
    const c = setNightModeReferenceMax(setNightModeReferenceMin(config, name, -30), name, -30);
    expect(p(c, name).reference_min).toBe(-30);
    expect(p(c, name).reference_max).toBe(-30);
  });

  it('removes a key when its value is the default', () => {
    const { config, name } = base();
    const set = setNightModeReferenceSlew(
      setNightModeReferenceMin(setNightModeReferenceMax(config, name, -20), name, -40),
      name,
      1
    );
    const reset = setNightModeReferenceSlew(
      setNightModeReferenceMin(setNightModeReferenceMax(set, name, -12), name, -45),
      name,
      0.25
    );
    expect('reference_max' in p(reset, name)).toBe(false);
    expect('reference_min' in p(reset, name)).toBe(false);
    expect('reference_slew' in p(reset, name)).toBe(false);
  });

  it('never emits min > max or out-of-range values across a sweep', () => {
    const { config, name } = base();
    let c = config;
    for (const v of [-50, -12, -30, -45, 0, -20, -44, -13]) {
      c = setNightModeReferenceMin(c, name, v);
      c = setNightModeReferenceMax(c, name, v + 7);
      const mn = p(c, name).reference_min ?? -45;
      const mx = p(c, name).reference_max ?? -12;
      expect(mn).toBeGreaterThanOrEqual(-45);
      expect(mx).toBeLessThanOrEqual(-12);
      expect(mn).toBeLessThanOrEqual(mx);
    }
  });

  it('keeps bounds and speed when the reference is pinned and unpinned', () => {
    const { config, name } = base();
    const c = setNightModeReferenceMax(config, name, -20);
    const round = setNightModeReferenceLevel(setNightModeReferenceLevel(c, name, -30), name, null);
    expect(p(round, name).reference_max).toBe(-20);
  });

  it('rejects unrelated processors', () => {
    const { config } = base();
    expect(() => setNightModeReferenceMax(config, 'missing', -20)).toThrow();
    const other = JSON.parse(JSON.stringify(config));
    other.processors.comp = { type: 'Compressor', parameters: { channels: 2 } };
    expect(() => setNightModeReferenceMin(other, 'comp', -20)).toThrow(/not a NightMode/);
    expect(setNightModeReferenceMin(other, findNightMode(other)!.name, -20).processors.comp).toEqual(
      other.processors.comp
    );
  });
});

describe('night mode reference slider rows', () => {
  it('shows max, min and follow speed with defaults while adaptive', () => {
    const config = addNightMode(fourToTwoConfig());
    const rows = referenceBoundRows(findNightMode(config)!.parameters);
    expect(rows.map((r) => [r.spec.key, r.value])).toEqual([
      ['reference_max', -12],
      ['reference_min', -45],
      ['reference_slew', 0.25],
    ]);
  });

  it('has no rows while the reference is pinned, and again after unpinning', () => {
    const config = addNightMode(fourToTwoConfig());
    const name = findNightMode(config)!.name;
    const pinned = setNightModeReferenceLevel(config, name, -30);
    expect(referenceBoundRows(findNightMode(pinned)!.parameters)).toEqual([]);
    const unpinned = setNightModeReferenceLevel(pinned, name, null);
    expect(referenceBoundRows(findNightMode(unpinned)!.parameters)).toHaveLength(3);
  });

  it('re-reads values after every change so the sliders keep moving', () => {
    let config = addNightMode(fourToTwoConfig());
    const name = findNightMode(config)!.name;
    const values = () => referenceBoundRows(findNightMode(config)!.parameters).map((r) => r.value);

    config = setNightModeReferenceMax(config, name, -20);
    expect(values()).toEqual([-20, -45, 0.25]);
    config = setNightModeReferenceMax(config, name, -25);
    expect(values()).toEqual([-25, -45, 0.25]);
    config = setNightModeReferenceMin(config, name, -30);
    expect(values()).toEqual([-25, -30, 0.25]);
    config = setNightModeReferenceSlew(config, name, 2);
    config = setNightModeReferenceSlew(config, name, 0.5);
    expect(values()).toEqual([-25, -30, 0.5]);
  });
});
