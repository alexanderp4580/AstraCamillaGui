/**
 * Saving the running CamillaDSP config to the file it loads on startup, so changes
 * survive a restart.
 */

import { writable } from 'svelte/store';
import { putDspConfigFile } from '../lib/api';
import { getDspInstance, unsavedChanges } from './dspStore';
import { commitUpload, isSoloSessionActive } from './eqStore';
import { flushPipelineUpload } from './pipelineEditor';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveStatus {
  state: SaveState;
  message?: string;
}

export const saveStatus = writable<SaveStatus>({ state: 'idle' });

/**
 * Save what CamillaDSP is running right now. Pending edits are flushed first; the DSP
 * serializes commands, so the config read back afterwards already includes them.
 */
export async function saveRunningConfig(): Promise<boolean> {
  const dsp = getDspInstance();
  if (!dsp || !dsp.connected) {
    saveStatus.set({ state: 'error', message: 'Not connected to CamillaDSP' });
    return false;
  }
  if (isSoloSessionActive()) {
    saveStatus.set({ state: 'error', message: 'Finish solo band editing before saving' });
    return false;
  }

  saveStatus.set({ state: 'saving' });
  commitUpload();
  flushPipelineUpload();

  try {
    const yaml = await dsp.getConfigYaml();
    if (!yaml) {
      throw new Error('Could not read the running config from CamillaDSP');
    }
    await putDspConfigFile(yaml);
    unsavedChanges.set(false);
    saveStatus.set({ state: 'saved' });
    setTimeout(() => {
      saveStatus.update((s) => (s.state === 'saved' ? { state: 'idle' } : s));
    }, 2000);
    return true;
  } catch (error) {
    saveStatus.set({
      state: 'error',
      message: error instanceof Error ? error.message : 'Save failed',
    });
    return false;
  }
}
