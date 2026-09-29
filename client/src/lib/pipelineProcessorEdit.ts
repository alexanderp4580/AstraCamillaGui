/**
 * Pure utility functions for editing processor parameters in pipeline
 * All functions return new config objects (immutable pattern)
 */

import type { GuiReadyCamillaDSPConfig } from './camillaDSP';
import {
  getNightModeParamSpec,
  REFERENCE_LEVEL_MIN,
  REFERENCE_LEVEL_MAX,
  type NightModeParamKey,
} from './nightModeParams';

/**
 * Set processor pipeline step bypass state
 */
export function setProcessorStepBypassed(
  config: GuiReadyCamillaDSPConfig,
  stepIndex: number,
  bypassed: boolean
): GuiReadyCamillaDSPConfig {
  const updated = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;

  if (!updated.pipeline || stepIndex >= updated.pipeline.length) {
    throw new Error(`Invalid pipeline step index: ${stepIndex}`);
  }

  const step = updated.pipeline[stepIndex];
  if (!step || step.type !== 'Processor') {
    throw new Error(`Pipeline step ${stepIndex} is not a Processor step`);
  }

  (step as any).bypassed = bypassed;

  return updated;
}

/**
 * Set compressor parameter
 */
export function setCompressorParam(
  config: GuiReadyCamillaDSPConfig,
  processorName: string,
  param: 'threshold' | 'attack' | 'release' | 'factor' | 'makeup_gain' | 'channels',
  value: number
): GuiReadyCamillaDSPConfig {
  const updated = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;

  if (!updated.processors || !updated.processors[processorName]) {
    throw new Error(`Processor "${processorName}" not found`);
  }

  const processor = updated.processors[processorName];
  if (processor.type !== 'Compressor') {
    throw new Error(`Processor "${processorName}" is not a Compressor`);
  }

  // Apply minimal safety clamping and round to 2 decimals consistently
  let clampedValue = value;

  switch (param) {
    case 'attack':
    case 'release':
      // Time values must be >= 0, rounded to 2 decimals
      clampedValue = Math.round(Math.max(0, value) * 100) / 100;
      break;
    case 'factor':
      // Factor must be >= 1, rounded to 2 decimals
      clampedValue = Math.round(Math.max(1, value) * 100) / 100;
      break;
    case 'channels':
      // Integer >= 1
      clampedValue = Math.max(1, Math.floor(value));
      break;
    case 'threshold':
    case 'makeup_gain':
      // Allow any value (power users may need extreme values), rounded to 2 decimals
      clampedValue = Math.round(value * 100) / 100;
      break;
  }

  processor.parameters[param] = clampedValue;

  return updated;
}

/**
 * Set noise gate parameter
 */
export function setNoiseGateParam(
  config: GuiReadyCamillaDSPConfig,
  processorName: string,
  param: 'threshold' | 'attack' | 'release' | 'attenuation' | 'channels',
  value: number
): GuiReadyCamillaDSPConfig {
  const updated = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;

  if (!updated.processors || !updated.processors[processorName]) {
    throw new Error(`Processor "${processorName}" not found`);
  }

  const processor = updated.processors[processorName];
  if (processor.type !== 'NoiseGate') {
    throw new Error(`Processor "${processorName}" is not a NoiseGate`);
  }

  // Apply minimal safety clamping and round to 2 decimals consistently
  let clampedValue = value;

  switch (param) {
    case 'attack':
    case 'release':
      // Time values must be >= 0, rounded to 2 decimals
      clampedValue = Math.round(Math.max(0, value) * 100) / 100;
      break;
    case 'channels':
      // Integer >= 1
      clampedValue = Math.max(1, Math.floor(value));
      break;
    case 'threshold':
    case 'attenuation':
      // Allow any value (power users may need extreme values), rounded to 2 decimals
      clampedValue = Math.round(value * 100) / 100;
      break;
  }

  processor.parameters[param] = clampedValue;

  return updated;
}

/**
 * Set night mode processor parameter
 */
export function setNightModeParam(
  config: GuiReadyCamillaDSPConfig,
  processorName: string,
  param: NightModeParamKey | 'channels',
  value: number
): GuiReadyCamillaDSPConfig {
  const updated = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;

  if (!updated.processors || !updated.processors[processorName]) {
    throw new Error(`Processor "${processorName}" not found`);
  }

  const processor = updated.processors[processorName];
  if (processor.type !== 'NightMode') {
    throw new Error(`Processor "${processorName}" is not a NightMode`);
  }

  // Clamp to the range the DSP accepts, rounded to 2 decimals
  let clampedValue: number;
  const spec = getNightModeParamSpec(param);
  if (spec) {
    clampedValue = Math.round(Math.min(spec.max, Math.max(spec.min, value)) * 100) / 100;
  } else {
    clampedValue = Math.max(1, Math.floor(value));
  }

  processor.parameters[param] = clampedValue;

  return updated;
}

/**
 * Pin or unpin the dialogue reference. Pinned (a number) stops it adapting to the
 * content and holds it at a fixed level instead — the DSP only accepts a pinned
 * value inside [-45, -12] dBFS. Unpinned (null) restores the normal adaptive
 * behaviour, which is what makes one setup work across quiet and loud material.
 */
export function setNightModeReferenceLevel(
  config: GuiReadyCamillaDSPConfig,
  processorName: string,
  value: number | null
): GuiReadyCamillaDSPConfig {
  const updated = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;

  if (!updated.processors || !updated.processors[processorName]) {
    throw new Error(`Processor "${processorName}" not found`);
  }

  const processor = updated.processors[processorName];
  if (processor.type !== 'NightMode') {
    throw new Error(`Processor "${processorName}" is not a NightMode`);
  }

  processor.parameters.reference_level =
    value === null
      ? null
      : Math.round(Math.min(REFERENCE_LEVEL_MAX, Math.max(REFERENCE_LEVEL_MIN, value)) * 100) / 100;

  return updated;
}
