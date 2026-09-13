/**
 * Mock CamillaDSP WebSocket server for testing
 * Implements minimal protocol per docs/api-contract-camillaDSP.md
 */

import { WebSocketServer, WebSocket } from 'ws';

export interface MockCamillaDSPOptions {
  controlPort?: number;
}

const DEFAULT_CONTROL_PORT = 3146;
// Mirrors CamillaDSP's ANALYSIS_POLL_INTERVAL (see socketserver.rs in the DSP repo).
const ANALYSIS_PUSH_INTERVAL_MS = 100;

export class MockCamillaDSP {
  private controlServer: WebSocketServer | null = null;
  private controlPort: number;
  private config: any = null;
  // Per-connection push state — mirrors the real server's per-connection
  // subscription tracking (see LocalData in socketserver.rs).
  private pushTimers = new Map<WebSocket, ReturnType<typeof setInterval>>();
  private subscriptions = new Map<WebSocket, { spectrum: boolean; energy: boolean }>();
  private spectrumSeq = 0;
  private energySeq = 0;

  constructor(options: MockCamillaDSPOptions = {}) {
    this.controlPort = options.controlPort || DEFAULT_CONTROL_PORT;
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    await this.startControlServer();
  }

  /**
   * Start control WebSocket server
   */
  private async startControlServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.controlServer = new WebSocketServer({ port: this.controlPort });

        this.controlServer.on('listening', () => {
          console.log(`Mock CamillaDSP control server listening on port ${this.controlPort}`);
          resolve();
        });

        this.controlServer.on('error', (error: any) => {
          console.error('Control server error:', error);
          reject(error);
        });

        this.controlServer.on('connection', (ws: WebSocket) => {
          this.subscriptions.set(ws, { spectrum: false, energy: false });
          ws.on('message', (data: Buffer) => {
            this.handleControlMessage(ws, data.toString());
          });
          ws.on('close', () => {
            this.stopPushingIfIdle(ws);
            this.subscriptions.delete(ws);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle control socket messages
   */
  private handleControlMessage(ws: WebSocket, message: string): void {
    try {
      const request = JSON.parse(message);
      const command = typeof request === 'string' ? request : Object.keys(request)[0];

      switch (command) {
        case 'GetVersion':
          this.sendResponse(ws, 'GetVersion', { result: 'Ok', value: '3.0.0' });
          break;

        case 'GetConfigJson':
          this.sendResponse(ws, 'GetConfigJson', {
            result: 'Ok',
            value: JSON.stringify(this.getDefaultConfig()),
          });
          break;

        case 'GetConfig':
          this.sendResponse(ws, 'GetConfig', { result: 'Ok', value: this.getDefaultConfigYaml() });
          break;

        case 'GetConfigTitle':
          this.sendResponse(ws, 'GetConfigTitle', { result: 'Ok', value: 'Mock CamillaDSP Configuration' });
          break;

        case 'GetConfigDescription':
          this.sendResponse(ws, 'GetConfigDescription', { result: 'Ok', value: 'Test configuration for development' });
          break;

        case 'GetAvailableCaptureDevices':
          this.sendResponse(ws, 'GetAvailableCaptureDevices', {
            result: 'Ok',
            value: this.getMockCaptureDevices(),
          });
          break;

        case 'GetAvailablePlaybackDevices':
          this.sendResponse(ws, 'GetAvailablePlaybackDevices', {
            result: 'Ok',
            value: this.getMockPlaybackDevices(),
          });
          break;

        case 'SetConfigJson':
          this.config = JSON.parse(request.SetConfigJson);
          this.sendResponse(ws, 'SetConfigJson', { result: 'Ok', value: true });
          break;

        case 'Reload':
          this.sendResponse(ws, 'Reload', { result: 'Ok', value: 'Config reloaded' });
          break;

        case 'GetState':
          this.sendResponse(ws, 'GetState', { result: 'Ok', value: 'Running' });
          break;

        case 'GetVolume':
          this.sendResponse(ws, 'GetVolume', { result: 'Ok', value: 0 });
          break;

        case 'SetVolume':
          this.sendResponse(ws, 'SetVolume', { result: 'Ok', value: true });
          break;

        case 'GetCaptureRate':
          this.sendResponse(ws, 'GetCaptureRate', { result: 'Ok', value: 44100 });
          break;

        case 'GetProcessingLoad':
          this.sendResponse(ws, 'GetProcessingLoad', { result: 'Ok', value: 5.2 });
          break;

        case 'Subscribe':
          this.handleSubscribe(ws, request.Subscribe, true);
          this.sendResponse(ws, 'Subscribe', { result: 'Ok' });
          break;

        case 'Unsubscribe':
          this.handleSubscribe(ws, request.Unsubscribe, false);
          this.sendResponse(ws, 'Unsubscribe', { result: 'Ok' });
          break;

        default:
          console.warn(`Unhandled command: ${command}`);
          this.sendResponse(ws, command, { result: 'Error', value: 'Unknown command' });
      }
    } catch (error) {
      console.error('Error handling control message:', error);
    }
  }

  /**
   * Mirrors CamillaDSP's `AnalysisTopic` handling in socketserver.rs: `Spectrum` and
   * `Energy` topics toggle whether pushed frames are sent to this connection. Starts
   * or stops the per-connection push interval as needed, matching the real server's
   * "only pay for it while subscribed" behavior.
   */
  private handleSubscribe(ws: WebSocket, topics: unknown, subscribing: boolean): void {
    const sub = this.subscriptions.get(ws) ?? { spectrum: false, energy: false };
    for (const topic of Array.isArray(topics) ? topics : []) {
      if (topic === 'Energy') {
        sub.energy = subscribing;
      } else if (topic && typeof topic === 'object' && 'Spectrum' in topic) {
        sub.spectrum = subscribing;
      }
    }
    this.subscriptions.set(ws, sub);

    if (sub.spectrum || sub.energy) {
      this.startPushing(ws);
    } else {
      this.stopPushingIfIdle(ws);
    }
  }

  private startPushing(ws: WebSocket): void {
    if (this.pushTimers.has(ws)) {
      return;
    }
    const timer = setInterval(() => {
      const sub = this.subscriptions.get(ws);
      if (!sub || ws.readyState !== ws.OPEN) {
        return;
      }
      if (sub.spectrum) {
        this.spectrumSeq += 1;
        this.sendResponse(ws, 'SpectrumFrame', {
          seq: this.spectrumSeq,
          bins_db: this.generateMockSpectrumData(),
        });
      }
      if (sub.energy) {
        this.energySeq += 1;
        this.sendResponse(ws, 'EnergyFrame', {
          seq: this.energySeq,
          rms_db: [-20, -20],
          peak_db: [-15, -15],
        });
      }
    }, ANALYSIS_PUSH_INTERVAL_MS);
    this.pushTimers.set(ws, timer);
  }

  private stopPushingIfIdle(ws: WebSocket): void {
    const sub = this.subscriptions.get(ws);
    if (sub && (sub.spectrum || sub.energy)) {
      return;
    }
    const timer = this.pushTimers.get(ws);
    if (timer) {
      clearInterval(timer);
      this.pushTimers.delete(ws);
    }
  }

  /**
   * Send response to client
   */
  private sendResponse(ws: WebSocket, command: string, response: any): void {
    const message = { [command]: response };
    ws.send(JSON.stringify(message));
  }

  /**
   * Generate mock spectrum data in dBFS format
   * Returns 64 frequency bins (matching SpectrumStatus's default in the DSP fork)
   * with a realistic-looking curve. Range: -100 dBFS (silence) to -12 dBFS (typical peak)
   */
  private generateMockSpectrumData(): number[] {
    const numBins = 64;
    const bins: number[] = [];
    const time = Date.now() / 1000; // Use time for gentle animation
    
    const minDb = -100;
    const maxDb = -12;
    
    for (let i = 0; i < numBins; i++) {
      const freq = i / numBins; // Normalized frequency [0..1]
      
      // Create a multi-band spectrum curve (normalized 0..1)
      // Low frequencies: stronger
      const lowBand = Math.exp(-freq * 3) * 0.6;
      
      // Mid frequencies: moderate with a bump around 0.3-0.5
      const midBump = Math.exp(-Math.pow((freq - 0.4) * 4, 2)) * 0.4;
      
      // High frequencies: weaker, rolling off
      const highBand = Math.exp(-Math.pow((freq - 0.7) * 2, 2)) * 0.3;
      
      // Combine bands
      let magnitude = lowBand + midBump + highBand;
      
      // Add gentle time-based variation (breathing effect)
      const breathe = 0.8 + 0.2 * Math.sin(time * 0.5 + freq * Math.PI);
      magnitude *= breathe;
      
      // Add subtle noise for realism
      const noise = (Math.random() - 0.5) * 0.05;
      magnitude += noise;
      
      // Clamp to [0..1] range
      magnitude = Math.max(0, Math.min(1, magnitude));
      
      // Convert to dBFS: map [0..1] → [minDb..maxDb]
      const db = minDb + magnitude * (maxDb - minDb);
      bins.push(db);
    }
    
    return bins;
  }

  /**
   * Get default config YAML
   */
  private getDefaultConfigYaml(): string {
    return `---
devices:
  samplerate: 48000
  chunksize: 1024
  capture:
    type: Alsa
    channels: 2
    device: "hw:0"
    format: S32LE
  playback:
    type: Alsa
    channels: 2
    device: "hw:0"
    format: S32LE

filters: {}

mixers:
  recombine:
    description: "Mock Default Mixer"
    channels:
      in: 2
      out: 2
    mapping:
      - dest: 0
        sources:
          - channel: 0
            gain: 0
            inverted: false
            mute: false
        mute: false
      - dest: 1
        sources:
          - channel: 1
            gain: 0
            inverted: false
            mute: false
        mute: false

pipeline:
  - type: Mixer
    name: recombine
    description: "Mock Default Mixer"
  - type: Filter
    channels: [0]
    names: []
    description: "Channel 0 Filters"
  - type: Filter
    channels: [1]
    names: []
    description: "Channel 1 Filters"
`;
  }

  /**
   * Get mock capture devices
   */
  private getMockCaptureDevices(): [string, string | null][] {
    return [
      ['hw:0,0', 'Built-in Audio Analog Stereo'],
      ['hw:Loopback,0,0', 'Loopback, Loopback PCM, subdevice #0'],
      ['hw:Loopback,1,0', 'Loopback, Loopback PCM, subdevice #1'],
      ['default', null],
    ];
  }

  /**
   * Get mock playback devices
   */
  private getMockPlaybackDevices(): [string, string | null][] {
    return [
      ['hw:0,0', 'Built-in Audio Analog Stereo'],
      ['hw:1,0', 'USB Audio Device'],
      ['default', null],
    ];
  }

  /**
   * Get default config (JSON)
   */
  private getDefaultConfig(): any {
    if (this.config) {
      return this.config;
    }

    return {
      devices: {
        capture: {
          channels: 2,
          type: 'Alsa',
          device: 'hw:0',
        },
        playback: {
          channels: 2,
          type: 'Alsa',
          device: 'hw:0',
        },
      },
      filters: {},
      mixers: {
        recombine: {
          description: 'Mock Default Mixer',
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
      },
      pipeline: [
        {
          type: 'Mixer',
          name: 'recombine',
          description: 'Mock Default Mixer',
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
      ],
      processors: {},
    };
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    for (const timer of this.pushTimers.values()) {
      clearInterval(timer);
    }
    this.pushTimers.clear();
    this.subscriptions.clear();

    if (this.controlServer) {
      await new Promise<void>((resolve) => {
        this.controlServer!.close(() => {
          console.log('Mock control server stopped');
          resolve();
        });
      });
    }
  }
}
