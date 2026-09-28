import { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import { AppError, ErrorCode } from '../types/errors.js';

const MAX_YAML_SIZE = 1024 * 1024;

interface SaveBody {
  yaml: string;
}

/**
 * The file CamillaDSP loads on startup, set with DSP_CONFIG_FILE. Saving writes the
 * running config there so it survives a restart. Unset means saving is unavailable.
 */
function getDspConfigFile(): string | null {
  return process.env.DSP_CONFIG_FILE || null;
}

export function registerDspConfigFileRoutes(app: FastifyInstance): void {
  app.get('/api/dsp-config-file', async () => {
    return { path: getDspConfigFile() };
  });

  app.put<{ Body: SaveBody }>('/api/dsp-config-file', {
    schema: {
      body: {
        type: 'object',
        required: ['yaml'],
        properties: {
          yaml: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request) => {
    const path = getDspConfigFile();
    if (!path) {
      throw new AppError(
        ErrorCode.ERR_BAD_REQUEST,
        'Saving is not configured: set DSP_CONFIG_FILE to the file CamillaDSP loads on startup',
        400
      );
    }

    const { yaml } = request.body;
    if (Buffer.byteLength(yaml, 'utf-8') > MAX_YAML_SIZE) {
      throw new AppError(ErrorCode.ERR_CONFIG_TOO_LARGE, 'Config too large', 413);
    }
    if (!/^devices:/m.test(yaml) || !/^pipeline:/m.test(yaml)) {
      throw new AppError(ErrorCode.ERR_BAD_REQUEST, 'Not a complete CamillaDSP config', 400);
    }

    // Written in place rather than via temp file + rename, so a symlink pointing at
    // this file (moOde's working_config.yml) keeps pointing at it.
    try {
      await fs.writeFile(path, yaml, 'utf-8');
    } catch (error) {
      throw new AppError(
        ErrorCode.ERR_CONFIG_WRITE_FAILED,
        `Failed to write ${path}: ${(error as Error).message}`,
        500
      );
    }

    request.log.info({ path, bytes: Buffer.byteLength(yaml, 'utf-8') }, 'Saved DSP config file');
    return { success: true, path };
  });
}
