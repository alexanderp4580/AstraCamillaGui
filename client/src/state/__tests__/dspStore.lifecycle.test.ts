/**
 * dspStore lifecycle event tests
 * Verifies connected/error state derivation and failure logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type { SocketLifecycleEvent, DspEventInfo } from '../../lib/camillaDSP';

// Mock CamillaDSP module - this will be applied to all imports
vi.mock('../../lib/camillaDSP', () => {
  class MockCamillaDSP {
    connected = false;
    config = {
      devices: { capture: { channels: 2 }, playback: { channels: 2 } },
      filters: {},
      mixers: {},
      pipeline: [],
      processors: {},
    };

    onDspSuccess?: (info: DspEventInfo) => void;
    onDspFailure?: (info: DspEventInfo) => void;
    onSocketLifecycleEvent?: (event: SocketLifecycleEvent) => void;

    constructor() {
      // Constructor called when dspStore creates instance
    }

    async connect() {
      this.connected = true;
      return true;
    }

    disconnect() {
      this.connected = false;
    }

    isControlSocketOpen() {
      return this.connected;
    }

    async getVolume() {
      return 0;
    }

    async getVersion() {
      return '1.0.0';
    }

    async getAvailableCaptureDevices() {
      return [];
    }

    async getAvailablePlaybackDevices() {
      return [];
    }

    async getConfigYaml() {
      return '';
    }

    async getConfigTitle() {
      return '';
    }

    async getConfigDescription() {
      return '';
    }
  }

  return {
    CamillaDSP: MockCamillaDSP,
  };
});

// Import after mock is registered
import { dspState, connect, disconnect, getDspInstance } from '../dspStore';

describe('dspStore lifecycle event handling', () => {
  beforeEach(() => {
    // Mock localStorage
    const mockLocalStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null),
    };
    global.localStorage = mockLocalStorage as any;

    // Clean up from previous test
    disconnect();
  });

  it('should transition to connected when control socket opens', async () => {
    // Connect (this wires up callbacks)
    await connect('127.0.0.1', 1234);

    // Get the DSP instance and its lifecycle callback
    const dsp = getDspInstance();
    expect(dsp).toBeDefined();
    expect(dsp?.onSocketLifecycleEvent).toBeDefined();

    const lifecycleCallback = dsp!.onSocketLifecycleEvent!;

    lifecycleCallback({
      socket: 'control',
      type: 'open',
      message: 'Control socket connected',
      timestampMs: Date.now(),
    });

    const state = get(dspState);
    expect(state.connectionState).toBe('connected');
    expect(state.controlConnected).toBe(true);
  });

  it('should transition to error when control socket closes', async () => {
    // Connect
    await connect('127.0.0.1', 1234);

    const dsp = getDspInstance();
    const lifecycleCallback = dsp!.onSocketLifecycleEvent!;

    lifecycleCallback({
      socket: 'control',
      type: 'open',
      message: 'Control socket connected',
      timestampMs: Date.now(),
    });

    // Simulate control socket closing
    lifecycleCallback({
      socket: 'control',
      type: 'close',
      message: 'WebSocket closed',
      timestampMs: Date.now(),
    });

    // Verify state is now error
    const state = get(dspState);
    expect(state.connectionState).toBe('error');
    expect(state.controlConnected).toBe(false);
  });

  it('should log socket lifecycle close/error events to failures', async () => {
    // Connect
    await connect('127.0.0.1', 1234);

    const dsp = getDspInstance();
    const lifecycleCallback = dsp!.onSocketLifecycleEvent!;

    // Get initial failure count
    let state = get(dspState);
    const initialFailureCount = state.failures.length;

    // Simulate control socket closing
    const closeEvent: SocketLifecycleEvent = {
      socket: 'control',
      type: 'close',
      message: 'Connection lost',
      timestampMs: Date.now(),
    };

    lifecycleCallback(closeEvent);

    // Verify failure was logged
    state = get(dspState);
    expect(state.failures.length).toBe(initialFailureCount + 1);

    const lifecycleFailure = state.failures.find(
      f => f.command === 'Socket Lifecycle' && f.socket === 'control'
    );

    expect(lifecycleFailure).toBeDefined();
    expect(lifecycleFailure?.request).toBe('close');
    expect(lifecycleFailure?.response).toContain('Connection lost');
  });

  it('should handle control open->close->open cycle correctly', async () => {
    // Connect
    await connect('127.0.0.1', 1234);

    const dsp = getDspInstance();
    const lifecycleCallback = dsp!.onSocketLifecycleEvent!;

    lifecycleCallback({
      socket: 'control',
      type: 'open',
      message: 'Control socket connected',
      timestampMs: Date.now(),
    });

    let state = get(dspState);
    expect(state.connectionState).toBe('connected');
    expect(state.controlConnected).toBe(true);

    // Close
    lifecycleCallback({
      socket: 'control',
      type: 'close',
      message: 'Connection lost',
      timestampMs: Date.now(),
    });

    state = get(dspState);
    expect(state.connectionState).toBe('error');
    expect(state.controlConnected).toBe(false);

    // Reopen
    lifecycleCallback({
      socket: 'control',
      type: 'open',
      message: 'Control socket reconnected',
      timestampMs: Date.now(),
    });

    state = get(dspState);
    expect(state.connectionState).toBe('connected');
    expect(state.controlConnected).toBe(true);
  });

  it('should apply exponential backoff to reconnect attempts', async () => {
    // Use fake timers to control time
    vi.useFakeTimers();

    // Enable auto-reconnect in localStorage
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => {
        if (key === 'camillaDSP.autoReconnect') return 'true';
        if (key === 'camillaDSP.server') return '127.0.0.1';
        if (key === 'camillaDSP.controlPort') return '1234';
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null),
    };
    global.localStorage = mockLocalStorage as any;

    // Spy on console.log to verify backoff messages
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // First establish a successful connection
    await connect('127.0.0.1', 1234);
    const dsp = getDspInstance();
    const lifecycleCallback = dsp!.onSocketLifecycleEvent!;

    // Now mock CamillaDSP to always fail reconnection attempts
    const { CamillaDSP } = await import('../../lib/camillaDSP');
    const originalConnect = CamillaDSP.prototype.connect;
    CamillaDSP.prototype.connect = vi.fn().mockResolvedValue(false);

    try {
      consoleLogSpy.mockClear();

      // Simulate control socket close (triggers attemptReconnect)
      lifecycleCallback({
        socket: 'control',
        type: 'close',
        message: 'Connection lost',
        timestampMs: Date.now(),
      });

      // Run timers to trigger reconnect attempts
      await vi.advanceTimersByTimeAsync(1000); // First attempt
      await vi.advanceTimersByTimeAsync(2000); // Second attempt
      await vi.advanceTimersByTimeAsync(5000); // Third attempt

      // Verify exponential backoff by checking console.log messages
      const reconnectLogs = consoleLogSpy.mock.calls
        .map(call => call[0])
        .filter((msg: string) => typeof msg === 'string' && msg.includes('Reconnect attempt'));

      expect(reconnectLogs.length).toBeGreaterThanOrEqual(3);
      expect(reconnectLogs[0]).toContain('Reconnect attempt 1/10 in 1000ms');
      expect(reconnectLogs[1]).toContain('Reconnect attempt 2/10 in 2000ms');
      expect(reconnectLogs[2]).toContain('Reconnect attempt 3/10 in 5000ms');

    } finally {
      // Restore original implementation
      CamillaDSP.prototype.connect = originalConnect;
      vi.useRealTimers();
      consoleLogSpy.mockRestore();
    }
  });
});
