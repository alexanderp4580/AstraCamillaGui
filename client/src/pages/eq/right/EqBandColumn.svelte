<script lang="ts">
  import FilterIcon from '../../../components/icons/FilterIcons.svelte';
  import BandOrderIcon from '../../../components/icons/BandOrderIcon.svelte';
  import HSlider from '../../../components/HSlider.svelte';
  import type { EqBand } from '../../../dsp/filterResponse';
  import {
    setBandGain,
    setBandFreq,
    setBandQ,
    toggleBandEnabled,
    selectBand,
    startSoloSession,
    soloActiveBandIndex,
  } from '../../../state/eqStore';
  import { openFilterTypePicker } from '../../../state/eqUiOverlayStore';
  import { soloWhileEditing } from '../vizOptions/vizOptionsStore';

  export let band: EqBand;
  export let bandIndex: number;
  export let orderNumber: number;
  export let filterName: string;
  export let selected: boolean;

  function handleFilterIconClick(event: MouseEvent) {
    if (!band.enabled) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    const bandRow = target.closest('.band-column') as HTMLElement;
    if (!bandRow) return;
    openFilterTypePicker(bandIndex, target, bandRow);
    selectBand(bandIndex);
  }

  function handleMuteToggle() {
    toggleBandEnabled(bandIndex);
  }

  function handleFreqChange(event: CustomEvent<{ value: number }>) {
    if (band.enabled) setBandFreq(bandIndex, event.detail.value);
  }

  function handleGainChange(event: CustomEvent<{ value: number }>) {
    if (band.enabled) setBandGain(bandIndex, event.detail.value);
  }

  function handleQChange(event: CustomEvent<{ value: number }>) {
    if (band.enabled) setBandQ(bandIndex, event.detail.value);
  }

  function handleSelect() {
    selectBand(bandIndex);
    startSoloSession(bandIndex, $soloWhileEditing);
  }

  const formatFreq = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v.toFixed(0)) + ' Hz';
  const formatGain = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`;
  const formatQ = (v: number) => v.toFixed(2);

  $: supportsGain = band.type === 'Peaking' || band.type === 'LowShelf' || band.type === 'HighShelf';
  $: isSoloDimmed = $soloActiveBandIndex !== null && $soloActiveBandIndex !== bandIndex;
</script>

<div
  class="band-column band"
  class:solo-dimmed={isSoloDimmed}
  style="--band-color: var(--band-{(bandIndex % 10) + 1});"
  data-enabled={band.enabled}
  data-selected={selected}
  on:pointerdown|capture={handleSelect}
  role="button"
  tabindex="-1"
>
  <div class="band-header">
    <button
      type="button"
      class="filter-type-icon"
      aria-label="Change filter type for band {bandIndex + 1} — {band.type}"
      title="Band {bandIndex + 1} — {band.type}"
      on:click={handleFilterIconClick}
    >
      <FilterIcon type={band.type} />
    </button>

    <div class="order-icon">
      <BandOrderIcon position={orderNumber} title={filterName} />
    </div>

    <span class="band-name">{filterName}</span>

    <button
      class="mute-btn"
      class:muted={!band.enabled}
      title={band.enabled ? 'Mute' : 'Unmute'}
      on:click={handleMuteToggle}
    >
      <span class="mute-indicator"></span>
    </button>
  </div>

  <div class="band-sliders" class:disabled={!band.enabled}>
    <HSlider
      label="Freq"
      value={band.freq}
      min={20}
      max={20000}
      scale="log"
      formatValue={formatFreq}
      disabled={!band.enabled}
      on:change={handleFreqChange}
    />
    <HSlider
      label="Gain"
      value={band.gain}
      min={-24}
      max={24}
      scale="linear"
      formatValue={formatGain}
      disabled={!band.enabled || !supportsGain}
      on:change={handleGainChange}
    />
    <HSlider
      label="Q"
      value={band.q}
      min={0.1}
      max={10}
      scale="linear"
      formatValue={formatQ}
      disabled={!band.enabled}
      on:change={handleQChange}
    />
  </div>
</div>

<style>
  .band-column {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem;
    border-radius: 10px;
    border: 1px solid transparent;
    width: 100%;
    box-sizing: border-box;
  }

  .band-column[data-enabled='false'] {
    opacity: 0.5;
  }

  .band-column[data-selected='true'] {
    border-color: color-mix(in oklab, var(--band-color) 44%, var(--ui-border));
    background: color-mix(in oklab, var(--band-color) 4%, var(--ui-panel));
    box-shadow: 0 0 0 1px color-mix(in oklab, var(--band-color) 7%, transparent);
  }

  .band-header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .filter-type-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    cursor: pointer;
    background: transparent;
    border: 0;
    padding: 0;
    color: inherit;
  }

  .band-column[data-enabled='false'] .filter-type-icon {
    pointer-events: none;
  }

  .order-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 21px;
    height: 21px;
    flex: 0 0 auto;
    cursor: pointer;
  }

  .band-name {
    flex: 1;
    min-width: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--band-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mute-btn {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    padding: 0;
    background: transparent;
    border: 2px solid var(--band-outline);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mute-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--band-ink);
    transition: all 0.15s ease;
  }

  .mute-btn:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .mute-btn.muted .mute-indicator {
    background: transparent;
  }

  .mute-btn.muted {
    border-color: var(--ui-border);
    opacity: 0.5;
  }

  .band-sliders {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .band-sliders.disabled {
    pointer-events: none;
  }

  /* Solo-edit session: dim non-active bands */
  .band-column.solo-dimmed {
    opacity: 0.2;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }
</style>
