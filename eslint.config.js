import { defineConfig } from 'eslint/config';
import { baseConfig, nodeConfig, reactConfig, sonarjsConfig } from '@maresia-grill/eslint-config';

export default defineConfig([
  ...baseConfig,
  ...sonarjsConfig,
  ...reactConfig.map((config) => ({
    ...config,
    files: ['apps/web/**/*.{ts,tsx}', ...(config.files ?? [])],
  })),
  ...nodeConfig.map((config) => ({
    ...config,
    files: ['apps/functions/**/*.ts', 'tools/**/*.{js,mjs}', ...(config.files ?? [])],
  })),
]);
