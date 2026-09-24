<script lang="ts">
  import { onDestroy } from 'svelte';
  import { connectionState, getDspInstance } from '../state/dspStore';
  import { dbToNormalized } from '../dsp/spectrumParser';
  import type { CamillaDSP, EnergyFrame } from '../lib/camillaDSP';

  const METER_MIN_DB = -60;
  const METER_MAX_DB = 0;
  const PEAK_HOLD_MS = 1500;

  let frame: EnergyFrame | null = null;
  let subscribedDsp: CamillaDSP | null = null;
  let peakHold: { db: number; atMs: number }[] = [];

  function handleEnergyFrame(f: EnergyFrame): void {
    frame = f;
    const now = performance.now();
    peakHold = f.peakDb.map((db, i) => {
      const held = peakHold[i];
      if (held && held.db >= db && now - held.atMs < PEAK_HOLD_MS) {
        return held;
      }
      return { db, atMs: now };
    });
  }

  function startSubscription(): void {
    const dsp = getDspInstance();
    if (!dsp || subscribedDsp) return;
    subscribedDsp = dsp;
    dsp.onEnergyFrame = handleEnergyFrame;
    void dsp.subscribe(['Energy']);
  }

  function stopSubscription(): void {
    if (!subscribedDsp) return;
    subscribedDsp.onEnergyFrame = undefined;
    void subscribedDsp.unsubscribe(['Energy']);
    subscribedDsp = null;
    frame = null;
    peakHold = [];
  }

  $: if ($connectionState === 'connected') {
    startSubscription();
  } else {
    stopSubscription();
  }

  onDestroy(stopSubscription);

  function channelLabel(i: number, total: number): string {
    if (total === 2) return i === 0 ? 'L' : 'R';
    return `Ch ${i + 1}`;
  }

  function fillPercent(db: number): number {
    return dbToNormalized(db, METER_MIN_DB, METER_MAX_DB) * 100;
  }
</script>

<div class="energy-page">
  <h1>Energy Meter</h1>

  {#if $connectionState !== 'connected'}
    <p class="hint">Connect to a CamillaDSP instance to view the live energy meter.</p>
  {:else if !frame}
    <p class="hint">Waiting for energy data&hellip;</p>
  {:else}
    <div class="meters">
      {#each frame.rmsDb as rmsDb, i (i)}
        {@const peak = peakHold[i]}
        <div class="meter-channel">
          <div class="meter-track">
            <div class="meter-mask" style="height: {100 - fillPercent(rmsDb)}%"></div>
            {#if peak}
              <div class="meter-peak" style="bottom: {fillPercent(peak.db)}%"></div>
            {/if}
          </div>
          <div class="meter-label">{channelLabel(i, frame.rmsDb.length)}</div>
          <div class="meter-value">{rmsDb.toFixed(1)} dB</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .energy-page {
    max-width: 900px;
    margin: 2rem auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: calc(100vh - 4rem);
  }

  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ui-text);
    margin-bottom: 1.5rem;
    align-self: flex-start;
  }

  .hint {
    color: var(--ui-text-muted);
    margin-top: 2rem;
  }

  .meters {
    display: flex;
    gap: 2rem;
    align-items: flex-end;
    height: 100%;
    padding-bottom: 2rem;
  }

  .meter-channel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .meter-track {
    position: relative;
    width: 48px;
    height: 360px;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    overflow: hidden;
    /* Fixed to the track's own (constant) height, so each color band sits at
       a fixed dB threshold regardless of how much of the meter is masked. */
    background: linear-gradient(
      to top,
      var(--green) 0%,
      var(--green) 60%,
      var(--amber) 82%,
      #ff4444 95%
    );
  }

  /* Covers the unfilled portion from the top, revealing the track's fixed
     gradient underneath rather than painting a gradient onto a shrinking box. */
  .meter-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: var(--ui-panel);
    transition: height 80ms linear;
  }

  .meter-peak {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--ui-text);
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.6);
  }

  .meter-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ui-text-muted);
  }

  .meter-value {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    color: var(--ui-text-dim);
    min-width: 5ch;
    text-align: center;
  }
</style>
