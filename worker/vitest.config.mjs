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
              // Dev/test origin list (production wrangler.toml has no localhost/pages.dev).
              ALLOWED_ORIGIN: 'https://droptexas.com,https://www.droptexas.com,https://privacy-dashboard-bt.pages.dev,http://localhost:5173',
              API_TOKEN: 'test-legacy-token',
              TOTP_ENC_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
              PII_ENC_KEY: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
              ADMIN_BOOTSTRAP_TOKEN: 'test-bootstrap-token-0123456789abcdef',
              // Fake OAuth config for tests (provider endpoints are mocked in test/social.test.js).
              GOOGLE_CLIENT_ID: 'test-google-client', GOOGLE_CLIENT_SECRET: 'test-google-secret',
              MICROSOFT_CLIENT_ID: 'test-ms-client', MICROSOFT_CLIENT_SECRET: 'test-ms-secret',
              OAUTH_COOKIE_KEY: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
              OAUTH_REDIRECT_URIS: 'https://accounts.test/oauth/google/callback,https://accounts.test/oauth/microsoft/callback',
              ACCOUNTS_HOST: 'accounts.test', APP_ORIGIN: 'https://api.test',
            },
            kvNamespaces: ['RECORDS'],
            d1Databases: ['DB'],
          },
        },
      },
    },
  };
});
