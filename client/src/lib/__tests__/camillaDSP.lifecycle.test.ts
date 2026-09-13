/**
 * CamillaDSP lifecycle event tests
 * Verifies socket lifecycle events and transport-level error logging
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { CamillaDSP, type SocketLifecycleEvent, type DspEventInfo } from '../camillaDSP';

describe('CamillaDSP lifecycle events', () => {
  let wsServer: WebSocketServer;
  let dsp: CamillaDSP;
  let controlPort: number;

  beforeEach(() => {
    dsp = new CamillaDSP();

    // Use an ephemeral port to avoid collisions in parallel test runs
    wsServer = new WebSocketServer({ port: 0 });
    controlPort = (wsServer.address() as any).port;
  });

  afterEach(async () => {
    if (dsp) {
      dsp.disconnect();
    }

    if (wsServer) {
      wsServer.clients.forEach((client) => client.close());
      await new Promise<void>((resolve) => wsServer.close(() => resolve()));
    }
  });

  it('should emit an open lifecycle event on successful connect', async () => {
    const lifecycleEvents: SocketLifecycleEvent[] = [];

    wsServer.on('connection', (ws) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg === 'GetConfigJson') {
          ws.send(JSON.stringify({ GetConfigJson: { result: 'Ok', value: '{}' } }));
        }
      });
    });

    dsp.onSocketLifecycleEvent = (event) => {
      lifecycleEvents.push(event);
    };

    await dsp.connect('127.0.0.1', controlPort);
    await new Promise(resolve => setTimeout(resolve, 50));

    const controlOpen = lifecycleEvents.find(e => e.socket === 'control' && e.type === 'open');
    expect(controlOpen).toBeDefined();
    expect(controlOpen?.message).toContain('connected');
  });

  it('should emit a close lifecycle event when the socket closes', async () => {
    const lifecycleEvents: SocketLifecycleEvent[] = [];

    wsServer.on('connection', (ws) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg === 'GetConfigJson') {
          ws.send(JSON.stringify({ GetConfigJson: { result: 'Ok', value: '{}' } }));
        }
      });
    });

    dsp.onSocketLifecycleEvent = (event) => {
      lifecycleEvents.push(event);
    };

    await dsp.connect('127.0.0.1', controlPort);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Clear events from connection
    lifecycleEvents.length = 0;

    // Close the socket
    wsServer.clients.forEach((client) => client.close());
    await new Promise(resolve => setTimeout(resolve, 100));

    const controlClose = lifecycleEvents.find(e => e.socket === 'control' && e.type === 'close');
    expect(controlClose).toBeDefined();
  });

  it('should route transport errors through onDspFailure callback', async () => {
    const failures: DspEventInfo[] = [];

    wsServer.on('connection', (ws) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg === 'GetConfigJson') {
          ws.send(JSON.stringify({ GetConfigJson: { result: 'Ok', value: '{}' } }));
        }
        // Don't respond to GetConfigTitle - this will cause a timeout/transport error
      });
    });

    dsp.onDspFailure = (info) => {
      failures.push(info);
    };

    await dsp.connect('127.0.0.1', controlPort);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Clear any connection failures
    failures.length = 0;

    // Close the socket to trigger a transport error
    wsServer.clients.forEach((client) => client.close());
    await new Promise(resolve => setTimeout(resolve, 100));

    // A call after the socket has closed should hit sendOnce()'s "not connected" path
    await dsp.getConfigTitle().catch(() => {});

    const transportFailure = failures.find(f =>
      f.socket === 'control' &&
      f.response &&
      f.response.toString().includes('Transport error')
    );

    expect(transportFailure).toBeDefined();
    expect(transportFailure?.socket).toBe('control');
  });
});
