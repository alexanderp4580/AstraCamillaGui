/**
 * Analysis subscription readiness tests
 * Verifies that subscribe()/unsubscribe() handle "not connected yet" gracefully,
 * now that spectrum data comes from a Subscribe on the single control socket
 * rather than a dedicated second socket.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CamillaDSP } from '../camillaDSP';

describe('CamillaDSP analysis subscription readiness', () => {
  let dsp: CamillaDSP;
  let consoleWarnSpy: any;

  beforeEach(() => {
    dsp = new CamillaDSP();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should return false, not throw, when subscribing before connecting', async () => {
    // No control socket exists yet — sendDSPMessage rejects immediately,
    // subscribe() catches that and reports "not available" instead of throwing.
    const ok = await dsp.subscribe([{ Spectrum: {} }]);

    expect(ok).toBe(false);
  });

  it('should return false, not throw, when unsubscribing before connecting', async () => {
    const ok = await dsp.unsubscribe([{ Spectrum: {} }]);

    expect(ok).toBe(false);
  });

  it('should check control socket readiness helper', () => {
    // Initially not open
    expect(dsp.isControlSocketOpen()).toBe(false);
  });
});
