/**
 * CamillaDSP client module
 * Implements WebSocket communication with CamillaDSP backend
 * Based on docs/api-contract-camillaDSP.md specification
 */

import { SocketRequestQueue } from './requestQueue';
import type { PipelineStep } from './camillaSchema';

// Re-export canonical schema types
export type {
  CamillaDSPConfig,
  Filter,
  Mixer,
  Processor,
  PipelineStep,
  PipelineStepFilter,
  PipelineStepMixer,
  PipelineStepProcessor,
  Devices,
} from './camillaSchema';

export interface CamillaDSPOptions {
  controlTimeoutMs?: number;
}

// GUI-ready config type (normalized: required blocks always present)
export type GuiReadyCamillaDSPConfig = {
  title?: string;
  description?: string;
  devices: {
    samplerate: number;
    chunksize: number;
    capture: Record<string, any>;
    playback: Record<string, any>;
    [k: string]: any;
  };
  filters: Record<string, any>;
  mixers: Record<string, any>;
  processors: Record<string, any>;
  pipeline: any[];
};

// Runtime-specific types (not part of canonical DSP config)
interface DSPResponse {
  result: 'Ok' | 'Error' | string;
  value: any;
}

export interface DspEventInfo {
  timestampMs: number;
  socket: 'control';
  command: string;
  request: string;
  response: any;
}

export interface SocketLifecycleEvent {
  socket: 'control';
  type: 'open' | 'close' | 'error';
  message?: string;
  timestampMs: number;
}

export type DeviceEntry = [string, string | null];

/**
 * A topic subscribable via `subscribe()`/`unsubscribe()` for pushed analysis
 * frames instead of polling. Mirrors CamillaDSP's `AnalysisTopic` (see
 * AstraCamillaDsp's `socketserver.rs` and `ANALYSIS-API-PLAN.md`).
 */
export type AnalysisTopic =
  | { Spectrum: { num_bins?: number; fmin?: number; fmax?: number } }
  | 'Energy';

export interface SpectrumFrame {
  seq: number;
  binsDb: number[];
}

export interface EnergyFrame {
  seq: number;
  rmsDb: number[];
  peakDb: number[];
}

/**
 * CamillaDSP client class
 */
export class CamillaDSP {
  private ws: WebSocket | null = null;
  private server: string = '';
  private port: number = 0;

  public connected: boolean = false;
  public config: GuiReadyCamillaDSPConfig | null = null;

  /**
   * Check if control socket is open and ready
   */
  public isControlSocketOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // Event callbacks for failure tracking
  public onDspSuccess?: (info: DspEventInfo) => void;
  public onDspFailure?: (info: DspEventInfo) => void;

  // Lifecycle event callback
  public onSocketLifecycleEvent?: (event: SocketLifecycleEvent) => void;

  // Pushed analysis frames (see `subscribe()`/`unsubscribe()`). Unlike every other
  // message, these arrive unsolicited rather than in response to a request, so they
  // can't go through the request/response queue below — a persistent listener set
  // up in `connect()` routes them here instead. Harmless no-op if nothing is
  // subscribed: the server never sends a topic nobody asked for.
  public onSpectrumFrame?: (frame: SpectrumFrame) => void;
  public onEnergyFrame?: (frame: EnergyFrame) => void;

  // Request queue for serialization
  private controlQueue: SocketRequestQueue = new SocketRequestQueue();

  // Timeout configuration
  private options: CamillaDSPOptions;

  constructor(options: CamillaDSPOptions = {}) {
    this.options = {
      controlTimeoutMs: options.controlTimeoutMs ?? 5000,
    };
  }

  // Default mixer configuration
  private readonly defaultMixer = {
    recombine: {
      description: 'CamillaEQ Default Mixer',
      channels: { in: 2, out: 2 },
      mapping: [
        {
          dest: 0,
          sources: [
            { channel: 0, gain: 0, inverted: false, mute: false, scale: 'dB' },
            { channel: 1, gain: 0, inverted: false, mute: true, scale: 'dB' },
          ],
          mute: false,
        },
        {
          dest: 1,
          sources: [
            { channel: 1, gain: 0, inverted: false, mute: false, scale: 'dB' },
            { channel: 0, gain: 0, inverted: false, mute: true, scale: 'dB' },
          ],
          mute: false,
        },
      ],
    },
  };

  // Default pipeline configuration (v3-compatible)
  private readonly defaultPipeline: PipelineStep[] = [
    {
      type: 'Mixer',
      name: 'recombine',
      description: 'CamillaEQ Default Mixer',
      bypassed: false,
    },
    {
      type: 'Filter',
      channels: [0],
      names: [],
      description: 'Channel 0 Filters',
      bypassed: false,
    },
    {
      type: 'Filter',
      channels: [1],
      names: [],
      description: 'Channel 1 Filters',
      bypassed: false,
    },
  ];

  /**
   * Connect to CamillaDSP backend
   */
  async connect(server?: string, port?: number): Promise<boolean> {
    // Use provided params or try localStorage
    this.server = server || localStorage.getItem('camillaDSP.server') || '';
    // Support both 'controlPort' (new) and 'port' (legacy) keys
    this.port = port ||
                Number(localStorage.getItem('camillaDSP.controlPort')) ||
                Number(localStorage.getItem('camillaDSP.port')) ||
                0;

    if (!this.server) {
      console.error('No server specified');
      return false;
    }

    try {
      // Connect to control socket
      this.ws = await this.connectToDSP(this.server, this.port);
      this.connected = true;
      this.attachSocketLifecycleListeners(this.ws);
      this.attachAnalysisFrameListener(this.ws);
      console.log('Connected to DSP control socket');

      // Emit open event for control socket
      if (this.onSocketLifecycleEvent) {
        this.onSocketLifecycleEvent({
          socket: 'control',
          type: 'open',
          message: 'Control socket connected',
          timestampMs: Date.now(),
        });
      }

      // Initialize after connection
      const initSuccess = await this.initAfterConnection();
      if (!initSuccess) {
        console.error('Configuration initialization failed');
        return false;
      }

      // Save to localStorage (use 'controlPort' as primary key)
      localStorage.setItem('camillaDSP.server', this.server);
      localStorage.setItem('camillaDSP.controlPort', String(this.port));

      return true;
    } catch (error) {
      console.error('Connection error:', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Initialize after successful connection
   */
  private async initAfterConnection(): Promise<boolean> {
    try {
      await this.downloadConfig();
      if (this.config) {
        // Debug: Log raw downloaded config before normalization
        console.log('Raw downloaded config:', {
          filters: Object.keys(this.config.filters || {}).length,
          mixers: Object.keys(this.config.mixers || {}).length,
          pipeline: this.config.pipeline?.length || 0,
          pipelineSteps: this.config.pipeline?.map(step => ({
            type: step.type,
            names: (step as any).names?.length || 0,
          })),
        });
        
        this.config = this.getDefaultConfig(this.config);
      }
      return true;
    } catch (error) {
      console.error('Initialization error:', error);
      return false;
    }
  }

  /**
   * Connect to a WebSocket endpoint
   */
  private connectToDSP(server: string, port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      if (!server) {
        reject(new Error('No server string specified'));
        return;
      }

      const ws = new WebSocket(`ws://${server}:${port}`);

      const onOpen = () => {
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
        resolve(ws);
      };

      const onError = (error: Event) => {
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
        reject(error);
      };

      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onError);
    });
  }

  /**
   * Attach lifecycle listeners to keep connection flags synchronized
   * and emit lifecycle events
   */
  private attachSocketLifecycleListeners(ws: WebSocket): void {
    const handleClose = (event: CloseEvent) => {
      this.connected = false;
      console.log('Control socket closed');

      if (this.onSocketLifecycleEvent) {
        this.onSocketLifecycleEvent({
          socket: 'control',
          type: 'close',
          message: `WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`,
          timestampMs: Date.now(),
        });
      }
    };

    const handleError = (_event: Event) => {
      this.connected = false;

      if (this.onSocketLifecycleEvent) {
        this.onSocketLifecycleEvent({
          socket: 'control',
          type: 'error',
          message: 'WebSocket error',
          timestampMs: Date.now(),
        });
      }
    };

    ws.addEventListener('close', handleClose);
    ws.addEventListener('error', handleError);
  }

  /**
   * Route pushed `SpectrumFrame`/`EnergyFrame` messages to their callbacks. This is a
   * *permanent* listener, unlike the one-shot listeners `sendOnce` adds per request:
   * pushed frames arrive whenever the server feels like it, not in reply to anything
   * we sent, so nothing else would ever see them. It coexists peacefully with those
   * per-request listeners — each just ignores messages whose top-level key it doesn't
   * recognize.
   */
  private attachAnalysisFrameListener(ws: WebSocket): void {
    ws.addEventListener('message', (event: MessageEvent) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.SpectrumFrame && this.onSpectrumFrame) {
        this.onSpectrumFrame({
          seq: msg.SpectrumFrame.seq,
          binsDb: msg.SpectrumFrame.bins_db,
        });
      } else if (msg.EnergyFrame && this.onEnergyFrame) {
        this.onEnergyFrame({
          seq: msg.EnergyFrame.seq,
          rmsDb: msg.EnergyFrame.rms_db,
          peakDb: msg.EnergyFrame.peak_db,
        });
      }
    });
  }

  /**
   * Handle incoming DSP message
   * Improved: extracts error details from various response formats
   */
  private static handleDSPMessage(data: string): [boolean, any] {
    const res = JSON.parse(data);
    const responseCommand = Object.keys(res)[0];
    const response: DSPResponse = res[responseCommand];
    const { result, value } = response;

    // Special case: GetConfigJson returns JSON string that needs parsing
    if (responseCommand === 'GetConfigJson' && result === 'Ok') {
      return [true, JSON.parse(value)];
    }

    // On error, try to extract meaningful error message
    if (result !== 'Ok') {
      let errorMsg = value;
      
      // If value is falsy, try other fields
      if (!errorMsg) {
        errorMsg = (response as any).error || (response as any).message;
      }
      
      // If still no error, stringify the whole response
      if (!errorMsg) {
        errorMsg = JSON.stringify(response);
      }
      
      return [false, errorMsg];
    }

    return [true, value];
  }

  /**
   * Fire success/failure callbacks
   */
  private fireEventCallback(
    success: boolean,
    socket: 'control',
    command: string,
    request: string,
    response: any
  ): void {
    const info: DspEventInfo = {
      timestampMs: Date.now(),
      socket,
      command,
      request,
      response,
    };

    if (success && this.onDspSuccess) {
      this.onDspSuccess(info);
    } else if (!success && this.onDspFailure) {
      this.onDspFailure(info);
    }
  }

  /**
   * Send message to control socket with queueing and timeout
   * @private
   */
  private sendDSPMessage(message: string | Record<string, any>): Promise<any> {
    return this.controlQueue.enqueue(async (signal) => {
      return this.sendOnce(this.ws!, 'control', message, this.options.controlTimeoutMs!, signal);
    });
  }

  /**
   * Send a single message and wait for response with timeout and cancellation support
   * @private
   */
  private sendOnce(
    ws: WebSocket,
    socketLabel: 'control',
    message: string | Record<string, any>,
    timeoutMs: number,
    signal: AbortSignal
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const commandName = typeof message === 'string' ? message : Object.keys(message)[0];
      const requestStr = JSON.stringify(message);
      
      // Check socket state before attempting
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        const error = new Error(`${socketLabel} WebSocket not connected`);
        
        // Log transport-level failure
        this.fireEventCallback(false, socketLabel, commandName, requestStr, 
          `Transport error: WebSocket not connected (readyState: ${ws?.readyState ?? 'null'})`
        );
        
        reject(error);
        return;
      }

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let resolved = false;

      const cleanup = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        ws.removeEventListener('message', handleMessage);
        signal.removeEventListener('abort', handleAbort);
      };

      const handleMessage = (event: MessageEvent) => {
        if (resolved) return;

        try {
          const res = JSON.parse(event.data);
          const responseCommand = Object.keys(res)[0];

          // Only handle responses for our command
          if (responseCommand !== commandName) {
            return;
          }

          resolved = true;
          cleanup();

          const [success, value] = CamillaDSP.handleDSPMessage(event.data);

          // Fire callbacks for tracking
          this.fireEventCallback(success, socketLabel, commandName, requestStr, value);

          if (success) {
            resolve(value);
          } else {
            reject(new Error(`DSP command failed: ${commandName} - ${value || '<no error message>'}`));
          }
        } catch (error) {
          console.error('Error parsing WebSocket response:', error);
        }
      };

      const handleAbort = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          
          // Log abort as transport failure
          const abortReason = signal.reason || 'Request cancelled';
          this.fireEventCallback(false, socketLabel, commandName, requestStr, 
            `Transport error: ${abortReason}`
          );
          
          reject(signal.reason || new Error('Request cancelled'));
        }
      };

      // Set up abort handler
      signal.addEventListener('abort', handleAbort);

      // Check if already aborted
      if (signal.aborted) {
        handleAbort();
        return;
      }

      // Set up timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          
          const timeoutError = new Error(`DSP command timed out after ${timeoutMs}ms: ${commandName}`);
          
          // Log timeout as transport failure
          this.fireEventCallback(false, socketLabel, commandName, requestStr, 
            `Transport error: Timeout after ${timeoutMs}ms`
          );
          
          reject(timeoutError);
        }
      }, timeoutMs);

      ws.addEventListener('message', handleMessage);
      ws.send(requestStr);
    });
  }

  /**
   * Download config from DSP
   */
  async downloadConfig(): Promise<boolean> {
    try {
      this.config = await this.sendDSPMessage('GetConfigJson');
      return true;
    } catch (error) {
      console.error('Error downloading config:', error);
      return false;
    }
  }

  /**
   * Upload config to DSP
   * In v3, SetConfigJson applies directly - no Reload needed
   */
  async uploadConfig(): Promise<boolean> {
    if (!this.config) {
      console.error('No config to upload');
      return false;
    }

    if (!this.validateConfig()) {
      console.error('Invalid configuration');
      return false;
    }

    try {
      // Upload config (v3: SetConfigJson applies directly)
      await this.sendDSPMessage({
        SetConfigJson: JSON.stringify(this.config),
      });
      
      // Re-download to confirm what CamillaDSP accepted
      await this.downloadConfig();
      
      return true;
    } catch (error) {
      console.error('Error uploading config:', error);
      return false;
    }
  }

  /**
   * Reload config (apply changes)
   */
  async reload(): Promise<boolean> {
    try {
      await this.sendDSPMessage('Reload');
      return true;
    } catch (error) {
      console.error('Error reloading config:', error);
      return false;
    }
  }

  /**
   * Get DSP state
   */
  async getState(): Promise<string | null> {
    try {
      return await this.sendDSPMessage('GetState');
    } catch (error) {
      console.error('Error getting state:', error);
      return null;
    }
  }

  /**
   * Get volume
   */
  async getVolume(): Promise<number | null> {
    try {
      return await this.sendDSPMessage('GetVolume');
    } catch (error) {
      console.error('Error getting volume:', error);
      return null;
    }
  }

  /**
   * Set volume
   */
  async setVolume(volume: number): Promise<boolean> {
    try {
      await this.sendDSPMessage({ SetVolume: volume });
      return true;
    } catch (error) {
      console.error('Error setting volume:', error);
      return false;
    }
  }

  /**
   * Validate config structure
   */
  validateConfig(): boolean {
    if (!this.config) {
      return false;
    }

    // Check if mixers in pipeline are defined
    const mixers = this.config.pipeline.filter((e) => e.type === 'Mixer');
    for (const mixer of mixers) {
      if (!this.config.mixers[(mixer as any).name]) {
        console.error(`Mixer "${(mixer as any).name}" not found in config.mixers`);
        return false;
      }
    }

    // Check if filters in pipeline exist in filters
    const filters = this.config.pipeline.filter((e) => e.type === 'Filter');
    for (const filter of filters) {
      const names = (filter as any).names || [];
      for (const filterName of names) {
        if (!this.config.filters[filterName]) {
          console.error(`Filter "${filterName}" not found in config.filters`);
          return false;
        }
      }
    }

    // Check if processor steps reference existing processors
    const processors = this.config.pipeline.filter((e) => e.type !== 'Filter' && e.type !== 'Mixer');
    for (const processor of processors) {
      const procStep = processor as any;
      if (!procStep.name) {
        console.error(`Processor step of type "${procStep.type}" has no name`);
        return false;
      }
      if (!this.config.processors || !this.config.processors[procStep.name]) {
        console.error(`Processor "${procStep.name}" not found in config.processors`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get default/normalized config
   * Preserves all data from CamillaDSP, only fills missing required fields
   * Returns GUI-ready config where filters/mixers/processors/pipeline are always present
   */
  private getDefaultConfig(config: any): GuiReadyCamillaDSPConfig {
    return {
      // Preserve title/description if present
      title: config.title,
      description: config.description,
      
      // Preserve devices or use default
      devices: config.devices || {
        samplerate: 48000,
        chunksize: 1024,
        capture: { channels: 2 },
        playback: { channels: 2 },
      },
      
      // Preserve filters, mixers, pipeline as-is (even if empty)
      filters: config.filters || {},
      mixers: config.mixers || {},
      pipeline: config.pipeline || [],
      
      // Ensure processors exists
      processors: config.processors || {},
    };
  }

  /**
   * Subscribe to one or more analysis topics (see `AnalysisTopic`). The server pushes
   * `SpectrumFrame`/`EnergyFrame` messages from then on — set `onSpectrumFrame`/
   * `onEnergyFrame` before calling this, not after, so the first frames aren't missed.
   * Returns false (rather than throwing) if the DSP doesn't understand `Subscribe` at
   * all — an older, unpatched CamillaDSP — so callers can treat that as "no live
   * analysis available" instead of a hard error.
   */
  async subscribe(topics: AnalysisTopic[]): Promise<boolean> {
    try {
      await this.sendDSPMessage({ Subscribe: topics });
      return true;
    } catch (error) {
      console.warn('Subscribe unavailable:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Unsubscribe from one or more analysis topics. Safe to call even if never
   * subscribed, or if the connection is already gone.
   */
  async unsubscribe(topics: AnalysisTopic[]): Promise<boolean> {
    try {
      await this.sendDSPMessage({ Unsubscribe: topics });
      return true;
    } catch (error) {
      console.warn('Unsubscribe failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Get CamillaDSP version
   */
  async getVersion(): Promise<string | null> {
    try {
      return await this.sendDSPMessage('GetVersion');
    } catch (error) {
      console.error('Error getting version:', error);
      return null;
    }
  }

  /**
   * Get available capture devices for a given backend
   */
  async getAvailableCaptureDevices(backend: string): Promise<DeviceEntry[] | null> {
    try {
      return await this.sendDSPMessage({ GetAvailableCaptureDevices: backend });
    } catch (error) {
      console.error('Error getting capture devices:', error);
      return null;
    }
  }

  /**
   * Get available playback devices for a given backend
   */
  async getAvailablePlaybackDevices(backend: string): Promise<DeviceEntry[] | null> {
    try {
      return await this.sendDSPMessage({ GetAvailablePlaybackDevices: backend });
    } catch (error) {
      console.error('Error getting playback devices:', error);
      return null;
    }
  }

  /**
   * Get config as YAML
   */
  async getConfigYaml(): Promise<string | null> {
    try {
      return await this.sendDSPMessage('GetConfig');
    } catch (error) {
      console.error('Error getting config YAML:', error);
      return null;
    }
  }

  /**
   * Get config title
   */
  async getConfigTitle(): Promise<string | null> {
    try {
      return await this.sendDSPMessage('GetConfigTitle');
    } catch (error) {
      console.error('Error getting config title:', error);
      return null;
    }
  }

  /**
   * Get config description
   */
  async getConfigDescription(): Promise<string | null> {
    try {
      return await this.sendDSPMessage('GetConfigDescription');
    } catch (error) {
      console.error('Error getting config description:', error);
      return null;
    }
  }

  /**
   * Disconnect from DSP
   */
  disconnect(): void {
    // Cancel all pending and in-flight requests
    this.controlQueue.cancelAll(new Error('Disconnected'));

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}
