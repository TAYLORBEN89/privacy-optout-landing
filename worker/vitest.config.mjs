import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';

// Throwaway Apple .p8-style key generated per test run (never a real key).
const applePem = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
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
              PII_ENC_KEY: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
              ADMIN_BOOTSTRAP_TOKEN: 'test-bootstrap-token-0123456789abcdef',
              // Fake OAuth config for tests (provider endpoints are mocked in test/social.test.js).
              GOOGLE_CLIENT_ID: 'test-google-client', GOOGLE_CLIENT_SECRET: 'test-google-secret',
              MICROSOFT_CLIENT_ID: 'test-ms-client', MICROSOFT_CLIENT_SECRET: 'test-ms-secret',
              APPLE_CLIENT_ID: 'test.apple.services', APPLE_TEAM_ID: 'TESTTEAM01', APPLE_KEY_ID: 'TESTKEY001', APPLE_PRIVATE_KEY: applePem,
              OAUTH_COOKIE_KEY: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
              OAUTH_REDIRECT_URIS: 'https://api.test/api/auth/google/callback,https://api.test/api/auth/apple/callback,https://api.test/api/auth/microsoft/callback',
            },
            kvNamespaces: ['RECORDS'],
            d1Databases: ['DB'],
          },
        },
      },
    },
  };
});
