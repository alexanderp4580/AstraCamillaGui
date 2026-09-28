/**
 * Locating and adding the NightMode processor, for the dedicated night mode page.
 * All functions return new config objects (immutable pattern).
 */

import type { GuiReadyCamillaDSPConfig } from './camillaDSP';
import { createNewProcessorBlock, insertPipelineStep } from './pipelineBlockEdit';
import { channelsAtPipelineIndex } from './pipelineChannels';

export interface NightModeLocation {
  name: string;
  stepIndex: number;
  bypassed: boolean;
  parameters: Record<string, any>;
}

/**
 * First NightMode processor that sits in the pipeline, or null.
 */
export function findNightMode(config: GuiReadyCamillaDSPConfig): NightModeLocation | null {
  const pipeline = config.pipeline || [];
  for (let i = 0; i < pipeline.length; i++) {
    const step = pipeline[i];
    if (step.type !== 'Processor') continue;
    const def = config.processors?.[step.name];
    if (def?.type === 'NightMode') {
      return {
        name: step.name,
        stepIndex: i,
        bypassed: step.bypassed === true,
        parameters: def.parameters || {},
      };
    }
  }
  return null;
}

/**
 * Append a NightMode processor at the end of the pipeline, sized to the pipeline's
 * output channel count. Night mode belongs last: after EQ, so boosts cannot push the
 * signal past its ceiling.
 */
export function addNightMode(config: GuiReadyCamillaDSPConfig): GuiReadyCamillaDSPConfig {
  const { processorName, processorDef, step } = createNewProcessorBlock(config, 'NightMode', 'nightmode');
  const index = (config.pipeline || []).length;
  processorDef.parameters.channels = channelsAtPipelineIndex(config, index);

  const updated = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;
  updated.processors = { ...(updated.processors || {}), [processorName]: processorDef };
  return insertPipelineStep(updated, index, step);
}
