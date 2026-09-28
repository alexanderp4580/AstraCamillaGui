<script lang="ts">
  import { connectionState, unsavedChanges } from '../state/dspStore';
  import { uploadStatus } from '../state/eqStore';
  import { pipelineUploadStatus } from '../state/pipelineEditor';
  import { saveStatus, saveRunningConfig } from '../state/saveStore';

  $: isConnected = $connectionState === 'connected';

  // A rejected change is the one thing that must never be silent: the controls
  // would otherwise show a value CamillaDSP never applied.
  $: dspError =
    $pipelineUploadStatus.state === 'error'
      ? $pipelineUploadStatus.message
      : $uploadStatus.state === 'error'
        ? $uploadStatus.message
        : null;

  $: buttonLabel =
    $saveStatus.state === 'saving' ? 'Saving…' : $saveStatus.state === 'saved' ? 'Saved' : 'Save';
</script>

{#if isConnected}
  <div class="save-bar">
    <div class="messages">
      {#if dspError}
        <span class="error" role="alert">CamillaDSP rejected the change: {dspError}</span>
      {/if}
      {#if $saveStatus.state === 'error'}
        <span class="error" role="alert">Save failed: {$saveStatus.message}</span>
      {:else if $unsavedChanges}
        <span class="hint">Unsaved: a restart reverts these changes</span>
      {/if}
    </div>
    <button
      class="save-btn"
      class:dirty={$unsavedChanges}
      disabled={$saveStatus.state === 'saving'}
      on:click={saveRunningConfig}
      title="Save the running config so it survives a restart"
    >
      {buttonLabel}
    </button>
  </div>
{/if}

<style>
  .save-bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: var(--ui-panel);
    border-bottom: 1px solid var(--ui-border);
  }

  .messages {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8125rem;
  }

  .error {
    color: #ff9999;
    overflow-wrap: anywhere;
  }

  .hint {
    color: var(--ui-text-muted);
  }

  .save-btn {
    flex-shrink: 0;
    padding: 0.5rem 1.25rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--ui-border);
    border-radius: 4px;
    color: var(--ui-text);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .save-btn.dirty {
    background: rgba(120, 255, 190, 0.12);
    border-color: rgba(120, 255, 190, 0.5);
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
