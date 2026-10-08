<script lang="ts">
  import { connectionState, dspConfig, updateConfig } from '../state/dspStore';
  import { commitPipelineConfigChange } from '../state/pipelineEditor';
  import {
    setNightModeParam,
    setNightModeReferenceLevel,
    setNightModeReferenceMax,
    setNightModeReferenceMin,
    setNightModeReferenceSlew,
    setProcessorStepBypassed,
  } from '../lib/pipelineProcessorEdit';
  import { addNightMode, findNightMode } from '../lib/nightModeEdit';
  import {
    NIGHT_MODE_PARAMS,
    REFERENCE_LEVEL_MIN,
    REFERENCE_LEVEL_MAX,
    REFERENCE_LEVEL_DEFAULT_PIN,
    REFERENCE_BOUND_PARAMS,
    referenceBoundRows,
    type ReferenceBoundKey,
    type NightModeParamKey,
  } from '../lib/nightModeParams';
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
    apply((config) => {
      const withParams = NIGHT_MODE_PARAMS.reduce(
        (acc, spec) => setNightModeParam(acc, name, spec.key, spec.defaultValue),
        config
      );
      const unpinned = setNightModeReferenceLevel(withParams, name, null);
      return REFERENCE_BOUND_PARAMS.reduce(
        (acc, spec) => boundEditor(spec.key)(acc, name, spec.defaultValue),
        unpinned
      );
    });
  }

  function paramValue(key: NightModeParamKey, fallback: number): number {
    const raw = nightMode?.parameters[key];
    return raw === null || raw === undefined ? fallback : Number(raw);
  }

  // null = adaptive (the normal, dialogue-tracking behaviour)
  $: referencePinned = nightMode ? (nightMode.parameters.reference_level ?? null) : null;

  function togglePin(pinned: boolean): void {
    if (!nightMode) return;
    const name = nightMode.name;
    apply((config) =>
      setNightModeReferenceLevel(config, name, pinned ? REFERENCE_LEVEL_DEFAULT_PIN : null)
    );
  }

  function setReferenceLevel(value: number): void {
    if (!nightMode) return;
    const name = nightMode.name;
    apply((config) => setNightModeReferenceLevel(config, name, value));
  }

  function boundEditor(key: ReferenceBoundKey) {
    return key === 'reference_max'
      ? setNightModeReferenceMax
      : key === 'reference_min'
        ? setNightModeReferenceMin
        : setNightModeReferenceSlew;
  }

  function setReferenceBound(key: ReferenceBoundKey, value: number): void {
    if (!nightMode) return;
    const name = nightMode.name;
    const edit = boundEditor(key);
    apply((config) => edit(config, name, value));
  }

  // Empty while pinned. Computed in one reactive statement for the same reason as
  // paramRows below.
  $: boundRows = nightMode ? referenceBoundRows(nightMode.parameters) : [];

  // Precomputed so the each-block below reacts to nightMode changing: a per-item
  // function call in the template (`paramValue(spec.key, ...)`) only reads nightMode
  // inside its body, not in the expression itself, so Svelte's compiler can't tell
  // this needs to be re-run when nightMode updates — it renders once and freezes.
  $: paramRows = nightMode
    ? NIGHT_MODE_PARAMS.map((spec) => ({ spec, value: paramValue(spec.key, spec.defaultValue) }))
    : [];

  function formatValue(v: number, unit: string): string {
    return `${v.toFixed(unit === ':1' ? 1 : 0)}${unit}`;
  }
</script>

<div class="night-page">
  <h1>Night Mode</h1>
  <p class="intro">
    Makes films watchable at low volume: turns down explosions, gunfire and loud music
    while leaving dialogue alone. It follows the dialogue level automatically, so it keeps
    working when you change the TV volume, and adds no delay, so lip sync is unaffected.
    Changes apply live. Press Save to keep them after a restart.
  </p>

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
    <p class="hint">
      Off passes audio straight through. Settings are kept, so switching back on
      restores them.
    </p>

    <div class="params" class:inactive={nightMode.bypassed}>
      {#each paramRows as { spec, value } (spec.key)}
        <div class="param">
          <HSlider
            label={spec.label}
            {value}
            min={spec.min}
            max={spec.max}
            formatValue={(v) => formatValue(v, spec.unit)}
            on:change={(e) => setParam(spec.key, e.detail.value)}
          />
          <p class="param-help">{spec.help}</p>
          <p class="param-help effect">{spec.effect}</p>
        </div>
      {/each}
    </div>

    <button class="secondary-btn" on:click={resetDefaults}>Reset to defaults</button>
    <p class="hint">
      Defaults are deliberately strong. If night mode does too much, raise Headroom or
      lower Amount first.
    </p>

    <div class="reference-section">
      <label class="toggle">
        <input
          type="checkbox"
          checked={referencePinned !== null}
          on:change={(e) => togglePin(e.currentTarget.checked)}
        />
        <span>Pin reference{referencePinned !== null ? ` at ${referencePinned.toFixed(0)} dBFS` : ''}</span>
      </label>
      <p class="hint">
        Normally the threshold tracks the dialogue level automatically, which is what
        lets one setup work on both a quiet drama and a loud blockbuster — but on
        louder content it also tracks upward, narrowing the gap it has to work with.
        Limiting how high it may go with the max slider below keeps it adaptive.
        Pinning it to a fixed level removes that ceiling completely: measured on a film trailer,
        pinning turned an 11–14 dB reduction on the loudest moments into 31 dB. The
        trade-off is that a pin doesn't know this content's actual dialogue level, so
        it can compress quiet dialogue too, not just the loud parts — start with it
        near the bottom of the range and raise it if dialogue gets swallowed.
      </p>
      {#if referencePinned !== null}
        <HSlider
          label="Reference"
          value={referencePinned}
          min={REFERENCE_LEVEL_MIN}
          max={REFERENCE_LEVEL_MAX}
          formatValue={(v) => `${v.toFixed(0)} dBFS`}
          on:change={(e) => setReferenceLevel(e.detail.value)}
        />
      {:else}
        {#each boundRows as { spec, value } (spec.key)}
          <div class="param">
            <HSlider
              label={spec.label}
              {value}
              min={spec.min}
              max={spec.max}
              formatValue={(v) =>
                spec.key === 'reference_slew'
                  ? `${v.toFixed(2)}${spec.unit}`
                  : `${v.toFixed(0)}${spec.unit}`}
              on:change={(e) => setReferenceBound(spec.key, e.detail.value)}
            />
            <p class="param-help">{spec.help}</p>
            <p class="param-help effect">{spec.effect}</p>
          </div>
        {/each}
      {/if}
    </div>
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

  .hint,
  .intro {
    color: var(--ui-text-muted);
    margin: 0;
  }

  .hint,
  .intro {
    font-size: 0.875rem;
    line-height: 1.45;
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
    line-height: 1.4;
    color: var(--ui-text-muted);
  }

  .param-help.effect {
    color: var(--ui-text-dim, var(--ui-text-muted));
    font-style: italic;
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

  .reference-section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1rem;
    background: var(--ui-panel);
    border: 1px solid var(--ui-border);
    border-radius: 8px;
  }
</style>
