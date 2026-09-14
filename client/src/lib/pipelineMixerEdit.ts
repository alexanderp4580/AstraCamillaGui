/**
 * Mixer editing helpers
 * Pure functions for manipulating mixer definitions in pipeline configs
 */

import type { GuiReadyCamillaDSPConfig } from './camillaDSP';

/**
 * Set gain for a specific source in a mixer destination
 */
export function setMixerSourceGain(
  config: GuiReadyCamillaDSPConfig,
  mixerName: string,
  destIndex: number,
  sourceIndex: number,
  gain: number
): GuiReadyCamillaDSPConfig {
  const updatedConfig = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;
  const mixer = updatedConfig.mixers[mixerName];

  if (!mixer || !mixer.mapping || !mixer.mapping[destIndex]) {
    throw new Error(`Mixer "${mixerName}" or destination ${destIndex} not found`);
  }

  const sources = mixer.mapping[destIndex].sources;
  if (!sources || !sources[sourceIndex]) {
    throw new Error(`Source ${sourceIndex} not found in destination ${destIndex}`);
  }

  // Clamp gain to CamillaDSP range
  const clampedGain = Math.max(-150, Math.min(50, gain));
  sources[sourceIndex].gain = clampedGain;

  return updatedConfig;
}

/**
 * Toggle mute state for a specific source in a mixer destination
 */
export function toggleMixerSourceMute(
  config: GuiReadyCamillaDSPConfig,
  mixerName: string,
  destIndex: number,
  sourceIndex: number
): GuiReadyCamillaDSPConfig {
  const updatedConfig = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;
  const mixer = updatedConfig.mixers[mixerName];

  if (!mixer || !mixer.mapping || !mixer.mapping[destIndex]) {
    throw new Error(`Mixer "${mixerName}" or destination ${destIndex} not found`);
  }

  const sources = mixer.mapping[destIndex].sources;
  if (!sources || !sources[sourceIndex]) {
    throw new Error(`Source ${sourceIndex} not found in destination ${destIndex}`);
  }

  sources[sourceIndex].mute = !sources[sourceIndex].mute;

  return updatedConfig;
}

/**
 * Toggle inverted state for a specific source in a mixer destination
 */
export function toggleMixerSourceInverted(
  config: GuiReadyCamillaDSPConfig,
  mixerName: string,
  destIndex: number,
  sourceIndex: number
): GuiReadyCamillaDSPConfig {
  const updatedConfig = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;
  const mixer = updatedConfig.mixers[mixerName];

  if (!mixer || !mixer.mapping || !mixer.mapping[destIndex]) {
    throw new Error(`Mixer "${mixerName}" or destination ${destIndex} not found`);
  }

  const sources = mixer.mapping[destIndex].sources;
  if (!sources || !sources[sourceIndex]) {
    throw new Error(`Source ${sourceIndex} not found in destination ${destIndex}`);
  }

  sources[sourceIndex].inverted = !sources[sourceIndex].inverted;

  return updatedConfig;
}

/**
 * Toggle mute state for a destination
 */
export function setMixerDestMute(
  config: GuiReadyCamillaDSPConfig,
  mixerName: string,
  destIndex: number,
  mute: boolean
): GuiReadyCamillaDSPConfig {
  const updatedConfig = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;
  const mixer = updatedConfig.mixers[mixerName];

  if (!mixer || !mixer.mapping || !mixer.mapping[destIndex]) {
    throw new Error(`Mixer "${mixerName}" or destination ${destIndex} not found`);
  }

  mixer.mapping[destIndex].mute = mute;

  return updatedConfig;
}

/**
 * Add a source to a mixer destination
 */
export function addMixerSource(
  config: GuiReadyCamillaDSPConfig,
  mixerName: string,
  destIndex: number,
  channel: number
): GuiReadyCamillaDSPConfig {
  const updatedConfig = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;
  const mixer = updatedConfig.mixers[mixerName];

  if (!mixer || !mixer.mapping || !mixer.mapping[destIndex]) {
    throw new Error(`Mixer "${mixerName}" or destination ${destIndex} not found`);
  }

  const sources = mixer.mapping[destIndex].sources;
  if (!sources) {
    throw new Error(`Destination ${destIndex} has no sources array`);
  }

  // Check if source with this channel already exists
  const exists = sources.some((src: any) => src.channel === channel);
  if (exists) {
    throw new Error(`Source with channel ${channel} already exists in destination ${destIndex}`);
  }

  // Add new source with default values
  sources.push({
    channel,
    gain: 0,
    inverted: false,
    mute: false,
    scale: 'dB',
  });

  return updatedConfig;
}

/**
 * Remove a source from a mixer destination
 */
export function removeMixerSource(
  config: GuiReadyCamillaDSPConfig,
  mixerName: string,
  destIndex: number,
  sourceIndex: number
): GuiReadyCamillaDSPConfig {
  const updatedConfig = JSON.parse(JSON.stringify(config)) as GuiReadyCamillaDSPConfig;
  const mixer = updatedConfig.mixers[mixerName];

  if (!mixer || !mixer.mapping || !mixer.mapping[destIndex]) {
    throw new Error(`Mixer "${mixerName}" or destination ${destIndex} not found`);
  }

  const sources = mixer.mapping[destIndex].sources;
  if (!sources || !sources[sourceIndex]) {
    throw new Error(`Source ${sourceIndex} not found in destination ${destIndex}`);
  }

  sources.splice(sourceIndex, 1);

  return updatedConfig;
}
