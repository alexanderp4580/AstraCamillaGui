/**
 * Pure utility functions for editing processor parameters in pipeline
 * All functions return new config objects (immutable pattern)
 */

import type { GuiReadyCamillaDSPConfig } from './camillaDSP';

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
  param:
    | 'amount'
    | 'max_attenuation'
    | 'bass_reduction'
    | 'headroom'
    | 'ratio'
    | 'transient_softening'
    | 'dialogue_protection'
    | 'presence_gain'
    | 'channels',
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

  // Apply the same min/max bounds shown in the editor UI, rounded to 2 decimals
  let clampedValue = value;

  switch (param) {
    case 'amount':
    case 'transient_softening':
    case 'dialogue_protection':
      clampedValue = Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
      break;
    case 'max_attenuation':
      clampedValue = Math.round(Math.min(60, Math.max(0, value)) * 100) / 100;
      break;
    case 'bass_reduction':
    case 'headroom':
      clampedValue = Math.round(Math.min(24, Math.max(0, value)) * 100) / 100;
      break;
    case 'ratio':
      clampedValue = Math.round(Math.min(20, Math.max(1, value)) * 100) / 100;
      break;
    case 'presence_gain':
      clampedValue = Math.round(Math.min(12, Math.max(-12, value)) * 100) / 100;
      break;
    case 'channels':
      clampedValue = Math.max(1, Math.floor(value));
      break;
  }

  processor.parameters[param] = clampedValue;

  return updated;
}
