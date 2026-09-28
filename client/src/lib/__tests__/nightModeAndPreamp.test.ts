import { describe, it, expect } from 'vitest';
import type { GuiReadyCamillaDSPConfig } from '../camillaDSP';
import { applyEqBandsToConfig, extractEqBandsFromConfig } from '../camillaEqMapping';
import { addNightMode, findNightMode } from '../nightModeEdit';
import { channelsAtPipelineIndex } from '../pipelineChannels';
import { setNightModeParam } from '../pipelineProcessorEdit';

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
});
