<script lang="ts">
  import { connectionState, dspConfig, updateConfig } from '../state/dspStore';
  import { commitPipelineConfigChange } from '../state/pipelineEditor';
  import { setNightModeParam, setProcessorStepBypassed } from '../lib/pipelineProcessorEdit';
  import { addNightMode, findNightMode } from '../lib/nightModeEdit';
  import { NIGHT_MODE_PARAMS, type NightModeParamKey } from '../lib/nightModeParams';
  import type { GuiReadyCamillaDSPConfig } from '../lib/camillaDSP';
  import HSlider from '../components/HSlider.svelte';

  $: isConnected = $connectionState === 'connected';
  $: nightMode = $dspConfig ? findNightMode($dspConfig) : null;

  let editError: string | null = null;

  function apply(mutate: (config: GuiReadyCamillaDSPConfig) => GuiReadyCamillaDSPConfig): void {
    if (!$dspConfig) return;
    editError = null;
    try {
      const updated = mutate($dspConfig);
      updateConfig(updated);
      commitPipelineConfigChange(updated);
    } catch (error) {
      editError = error instanceof Error ? error.message : 'Edit failed';
    }
  }

  function setParam(key: NightModeParamKey, value: number): void {
    if (!nightMode) return;
    const name = nightMode.name;
    apply((config) => setNightModeParam(config, name, key, value));
  }

  function setEnabled(enabled: boolean): void {
    if (!nightMode) return;
    const stepIndex = nightMode.stepIndex;
    apply((config) => setProcessorStepBypassed(config, stepIndex, !enabled));
  }

  function resetDefaults(): void {
    if (!nightMode) return;
    const name = nightMode.name;
    apply((config) =>
      NIGHT_MODE_PARAMS.reduce(
        (acc, spec) => setNightModeParam(acc, name, spec.key, spec.defaultValue),
        config
      )
    );
  }

  function paramValue(key: NightModeParamKey, fallback: number): number {
    const raw = nightMode?.parameters[key];
    return raw === null || raw === undefined ? fallback : Number(raw);
  }

  function formatValue(v: number, unit: string): string {
    return `${v.toFixed(unit === ':1' ? 1 : 0)}${unit}`;
  }
</script>

<div class="night-page">
  <h1>Night Mode</h1>

  {#if !isConnected}
    <p class="hint">Connect to CamillaDSP to adjust night mode.</p>
  {:else if !$dspConfig}
    <p class="hint">Loading configuration&hellip;</p>
  {:else if !nightMode}
    <p class="hint">
      There is no night mode processor in the pipeline yet. Adding one puts it at the
      end of the pipeline, switched on with default settings.
    </p>
    <button class="primary-btn" on:click={() => apply(addNightMode)}>Add night mode</button>
  {:else}
    <label class="toggle">
      <input
        type="checkbox"
        checked={!nightMode.bypassed}
        on:change={(e) => setEnabled(e.currentTarget.checked)}
      />
      <span>{nightMode.bypassed ? 'Off' : 'On'}</span>
    </label>

    <div class="params" class:inactive={nightMode.bypassed}>
      {#each NIGHT_MODE_PARAMS as spec (spec.key)}
        <div class="param">
          <HSlider
            label={spec.label}
            value={paramValue(spec.key, spec.defaultValue)}
            min={spec.min}
            max={spec.max}
            formatValue={(v) => formatValue(v, spec.unit)}
            on:change={(e) => setParam(spec.key, e.detail.value)}
          />
          <p class="param-help">{spec.help}</p>
        </div>
      {/each}
    </div>

    <button class="secondary-btn" on:click={resetDefaults}>Reset to defaults</button>
  {/if}

  {#if editError}
    <p class="error" role="alert">{editError}</p>
  {/if}
</div>

<style>
  .night-page {
    max-width: 720px;
    margin: 1rem auto;
    padding: 0 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0;
  }

  .hint {
    color: var(--ui-text-muted);
    margin: 0;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-weight: 600;
    color: var(--ui-text);
    cursor: pointer;
    user-select: none;
  }

  .toggle input {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
  }

  .params {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--ui-panel);
    border: 1px solid var(--ui-border);
    border-radius: 8px;
  }

  .params.inactive {
    opacity: 0.6;
  }

  .param-help {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: var(--ui-text-muted);
  }

  .primary-btn,
  .secondary-btn {
    align-self: flex-start;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ui-text);
    cursor: pointer;
  }

  .primary-btn {
    background: rgba(212, 164, 255, 0.15);
    border: 1px solid rgba(212, 164, 255, 0.4);
  }

  .secondary-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--ui-border);
  }

  .error {
    color: #ff9999;
    margin: 0;
  }
</style>
