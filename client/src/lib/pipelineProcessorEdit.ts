/**
 * Pure utility functions for editing processor parameters in pipeline
 * All functions return new config objects (immutable pattern)
 */

import type { GuiReadyCamillaDSPConfig } from './camillaDSP';
import {
  getNightModeParamSpec,
  NIGHT_MODE_PARAMS,
  REFERENCE_LEVEL_MIN,
  REFERENCE_LEVEL_MAX,
  REFERENCE_MIN_DEFAULT,
  REFERENCE_MAX_DEFAULT,
  REFERENCE_SLEW_MIN,
  REFERENCE_SLEW_MAX,
  REFERENCE_SLEW_DEFAULT,
  REFERENCE_SLEW_STEP,
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

function nightModeParameters(
  config: GuiReadyCamillaDSPConfig,
  processorName: string
): { updated: GuiReadyCamillaDSPConfig; parameters: Record<string, any> } {
  const updated = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;

  if (!updated.processors || !updated.processors[processorName]) {
    throw new Error(`Processor "${processorName}" not found`);
  }

  const processor = updated.processors[processorName];
  if (processor.type !== 'NightMode') {
    throw new Error(`Processor "${processorName}" is not a NightMode`);
  }

  return { updated, parameters: processor.parameters as Record<string, any> };
}

function setOrOmit(parameters: Record<string, any>, key: string, value: number, defaultValue: number): void {
  if (value === defaultValue) {
    delete parameters[key];
  } else {
    parameters[key] = value;
  }
}

function clampBound(value: number): number {
  return Math.round(Math.min(REFERENCE_LEVEL_MAX, Math.max(REFERENCE_LEVEL_MIN, value)));
}

/**
 * Set the lowest level the adaptive reference may reach. Raising it above the
 * current max raises the max to match, so min <= max always holds. The default
 * is omitted from the config.
 */
export function setNightModeReferenceMin(
  config: GuiReadyCamillaDSPConfig,
  processorName: string,
  value: number
): GuiReadyCamillaDSPConfig {
  if (!Number.isFinite(value)) return config;
  const { updated, parameters } = nightModeParameters(config, processorName);
  const min = clampBound(value);
  const max = Number(parameters.reference_max ?? REFERENCE_MAX_DEFAULT);
  setOrOmit(parameters, 'reference_min', min, REFERENCE_MIN_DEFAULT);
  if (min > max) setOrOmit(parameters, 'reference_max', min, REFERENCE_MAX_DEFAULT);
  return updated;
}

/**
 * Set the highest level the adaptive reference may reach. Lowering it below the
 * current min lowers the min to match, so min <= max always holds. The default
 * is omitted from the config.
 */
export function setNightModeReferenceMax(
  config: GuiReadyCamillaDSPConfig,
  processorName: string,
  value: number
): GuiReadyCamillaDSPConfig {
  if (!Number.isFinite(value)) return config;
  const { updated, parameters } = nightModeParameters(config, processorName);
  const max = clampBound(value);
  const min = Number(parameters.reference_min ?? REFERENCE_MIN_DEFAULT);
  setOrOmit(parameters, 'reference_max', max, REFERENCE_MAX_DEFAULT);
  if (max < min) setOrOmit(parameters, 'reference_min', max, REFERENCE_MIN_DEFAULT);
  return updated;
}

/**
 * Set how fast the adaptive reference follows the dialogue level (dB/s), clamped
 * to 0.05..3 in steps of 0.05. The default is omitted from the config.
 */
export function setNightModeReferenceSlew(
  config: GuiReadyCamillaDSPConfig,
  processorName: string,
  value: number
): GuiReadyCamillaDSPConfig {
  if (!Number.isFinite(value)) return config;
  const { updated, parameters } = nightModeParameters(config, processorName);
  const stepped = Math.round(value / REFERENCE_SLEW_STEP) * REFERENCE_SLEW_STEP;
  const slew =
    Math.round(Math.min(REFERENCE_SLEW_MAX, Math.max(REFERENCE_SLEW_MIN, stepped)) * 100) / 100;
  setOrOmit(parameters, 'reference_slew', slew, REFERENCE_SLEW_DEFAULT);
  const min = Number(parameters.reference_min ?? REFERENCE_MIN_DEFAULT);
  const max = Number(parameters.reference_max ?? REFERENCE_MAX_DEFAULT);
  if (min > max) setOrOmit(parameters, 'reference_min', max, REFERENCE_MIN_DEFAULT);
  return updated;
}

/**
 * Restore every night mode setting to its default: the main parameters, the
 * adaptive reference (unpinned) and its min, max and follow speed.
 */
export function resetNightModeDefaults(
  config: GuiReadyCamillaDSPConfig,
  processorName: string
): GuiReadyCamillaDSPConfig {
  const withParams = NIGHT_MODE_PARAMS.reduce(
    (acc, spec) => setNightModeParam(acc, processorName, spec.key, spec.defaultValue),
    config
  );
  const unpinned = setNightModeReferenceLevel(withParams, processorName, null);
  return setNightModeReferenceSlew(
    setNightModeReferenceMax(
      setNightModeReferenceMin(unpinned, processorName, REFERENCE_MIN_DEFAULT),
      processorName,
      REFERENCE_MAX_DEFAULT
    ),
    processorName,
    REFERENCE_SLEW_DEFAULT
  );
}
