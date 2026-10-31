import path from 'node:path';
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));
  return {
    test: {
      setupFiles: ['./test/apply-migrations.js'],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            // Throwaway test-only values; everything runs in local Miniflare storage.
            bindings: {
              TEST_MIGRATIONS: migrations,
              API_TOKEN: 'test-legacy-token',
              TOTP_ENC_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            },
            kvNamespaces: ['RECORDS'],
            d1Databases: ['DB'],
          },
        },
      },
    },
  };
});
