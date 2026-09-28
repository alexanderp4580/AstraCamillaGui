import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AppError } from '../../types/errors.js';
import { registerDspConfigFileRoutes } from '../dspConfigFile.js';

const VALID_YAML = 'devices:\n  samplerate: 44100\npipeline:\n- type: Mixer\n  name: mix_down\n';

describe('DSP config file endpoint', () => {
  let app: FastifyInstance;
  let dir: string;
  const originalEnv = process.env;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(error.statusCode || 500).send({ error: { message: error.message } });
    });
    registerDspConfigFileRoutes(app);
    await app.ready();
    dir = await fs.mkdtemp(join(tmpdir(), 'dspcfg-'));
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('reports the configured path', async () => {
    process.env.DSP_CONFIG_FILE = '/some/where/custom';
    const response = await app.inject({ method: 'GET', url: '/api/dsp-config-file' });
    expect(JSON.parse(response.body)).toEqual({ path: '/some/where/custom' });
  });

  it('refuses to save when no path is configured', async () => {
    delete process.env.DSP_CONFIG_FILE;
    const response = await app.inject({
      method: 'PUT',
      url: '/api/dsp-config-file',
      payload: { yaml: VALID_YAML },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects something that is not a full config', async () => {
    process.env.DSP_CONFIG_FILE = join(dir, 'partial');
    const response = await app.inject({
      method: 'PUT',
      url: '/api/dsp-config-file',
      payload: { yaml: 'filters: {}\n' },
    });
    expect(response.statusCode).toBe(400);
    await expect(fs.access(join(dir, 'partial'))).rejects.toThrow();
  });

  it('writes through a symlink without replacing it', async () => {
    const target = join(dir, 'custom');
    const link = join(dir, 'working_config.yml');
    await fs.writeFile(target, 'old');
    await fs.symlink(target, link);
    process.env.DSP_CONFIG_FILE = link;

    const response = await app.inject({
      method: 'PUT',
      url: '/api/dsp-config-file',
      payload: { yaml: VALID_YAML },
    });

    expect(response.statusCode).toBe(200);
    expect((await fs.lstat(link)).isSymbolicLink()).toBe(true);
    expect(await fs.readFile(target, 'utf-8')).toBe(VALID_YAML);
  });
});
