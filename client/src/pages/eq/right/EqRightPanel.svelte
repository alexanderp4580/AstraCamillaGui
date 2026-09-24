<script lang="ts">
  import type { EqBand } from '../../../dsp/filterResponse';
  import MasterBandColumn from './MasterBandColumn.svelte';
  import EqBandColumn from './EqBandColumn.svelte';
  
  export let bands: EqBand[];
  export let filterNames: string[];
  export let bandOrderNumbers: (number | null)[];
  export let selectedBandIndex: number | null;
  export let preampGain: number;
</script>

<div class="eq-right">
  <div class="band-grid">
    <!-- Master/Preamp Band Column -->
    <MasterBandColumn {preampGain} />

    <!-- Band columns -->
    {#each bands as band, i}
      <EqBandColumn
        {band}
        bandIndex={i}
        orderNumber={bandOrderNumbers[i] ?? (i + 1)}
        filterName={filterNames[i]}
        selected={selectedBandIndex === i}
      />
    {/each}
  </div>
</div>

<style>
  .eq-right {
    width: 100%;
    min-width: 0;
  }

  .band-grid {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    width: 100%;
  }
</style>
