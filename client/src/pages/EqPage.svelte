<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { connectionState, dspConfig, getDspInstance } from '../state/dspStore';
  import {
    bands,
    filterNames,
    bandOrderNumbers,
    selectedBandIndex,
    preampGain,
    initializeFromConfig,
  } from '../state/eqStore';
  import { initializeVizOptions, setupVizOptionsPersistence } from './eq/vizOptions/vizOptionsStore';
  import EqLeftPanel from './eq/left/EqLeftPanel.svelte';
  import EqRightPanel from './eq/right/EqRightPanel.svelte';
  import EqOverlays from './eq/EqOverlays.svelte';

  // Track initialization state
  let eqInitialized = false;
  
  // Initialize viz options from localStorage and setup persistence
  let cleanupVizPersistence: (() => void) | null = null;
  
  onMount(() => {
    initializeVizOptions();
    cleanupVizPersistence = setupVizOptionsPersistence();
  });
  
  onDestroy(() => {
    if (cleanupVizPersistence) {
      cleanupVizPersistence();
    }
  });
  
  // Reactive: Initialize EQ when connection becomes available
  // This handles both immediate connection and delayed auto-reconnect
  $: {
    const dsp = getDspInstance();
    const config = $dspConfig;
    
    if (!eqInitialized && dsp && dsp.connected && config && $connectionState === 'connected') {
      // Initialize EQ store from config
      eqInitialized = initializeFromConfig(config);
      
      if (eqInitialized) {
        console.log('EQ store initialized from global DSP config');
      } else {
        console.warn('Failed to initialize EQ store from config');
      }
    }
  }
</script>

<div class="eq-layout">
  <!-- Left: EQ Plot Area -->
  <EqLeftPanel />

  <!-- Right: Band Columns (Scrollable) -->
  <EqRightPanel
    bands={$bands}
    filterNames={$filterNames}
    bandOrderNumbers={$bandOrderNumbers}
    selectedBandIndex={$selectedBandIndex}
    preampGain={$preampGain}
  />
  
  <!-- Overlays: Tooltips, Popovers, Pickers -->
  <EqOverlays />
</div>

<style>
  /* Vertical-first: plot on top, band controls stacked below, page scrolls.
     Works the same from phone widths up to desktop — no separate breakpoint
     layout to keep in sync. */
  .eq-layout {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    max-width: 900px;
    margin: 0 auto;
    box-sizing: border-box;
  }
</style>
