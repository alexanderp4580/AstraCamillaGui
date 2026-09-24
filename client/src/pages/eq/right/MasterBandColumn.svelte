<script lang="ts">
  import HSlider from '../../../components/HSlider.svelte';
  import { setPreampGain } from '../../../state/eqStore';

  export let preampGain: number;

  const formatGain = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`;

  function handleGainChange(event: CustomEvent<{ value: number }>) {
    setPreampGain(event.detail.value);
  }
</script>

<div class="band-column master-band band" style="--band-color: var(--band-10);">
  <div class="band-header">
    <span class="band-name">Preamp</span>
  </div>

  <div class="band-sliders">
    <HSlider
      label="Gain"
      value={preampGain}
      min={-24}
      max={24}
      scale="linear"
      formatValue={formatGain}
      on:change={handleGainChange}
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
    border: 1px solid var(--ui-border);
    width: 100%;
    box-sizing: border-box;
  }

  .master-band {
    opacity: 0.75;
  }

  .band-header {
    display: flex;
    align-items: center;
  }

  .band-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--band-ink);
  }

  .band-sliders {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
