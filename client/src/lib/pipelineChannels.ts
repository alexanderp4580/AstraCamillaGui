/**
 * Channel counts along the pipeline. Capture sets the starting count and only
 * Mixer steps change it, so a step inserted at a given position must be sized to
 * the count at that position or CamillaDSP rejects the config.
 */

import type { CamillaDSPConfig } from './camillaDSP';

/**
 * Number of channels flowing into pipeline position `index` (0 = before the first
 * step, `pipeline.length` = the pipeline's output).
 */
export function channelsAtPipelineIndex(config: CamillaDSPConfig, index: number): number {
  let channels = Number((config.devices?.capture as any)?.channels ?? 2);
  const pipeline = config.pipeline || [];
  for (let i = 0; i < Math.min(index, pipeline.length); i++) {
    const step = pipeline[i] as any;
    if (step.type !== 'Mixer' || step.bypassed) continue;
    const out = config.mixers?.[step.name]?.channels?.out;
    if (typeof out === 'number') channels = out;
  }
  return channels;
}

/**
 * Index just after the last active Mixer step, or 0 when there is none. Past that
 * point the channel count no longer changes.
 */
export function indexAfterLastMixer(config: CamillaDSPConfig): number {
  const pipeline = config.pipeline || [];
  for (let i = pipeline.length - 1; i >= 0; i--) {
    const step = pipeline[i] as any;
    if (step.type === 'Mixer' && !step.bypassed) return i + 1;
  }
  return 0;
}
