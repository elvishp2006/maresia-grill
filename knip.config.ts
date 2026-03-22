import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignoreWorkspaces: ['packages/tsconfig'],
  workspaces: {
    '.': {
      ignoreDependencies: [
        // Workspace-local package, not listed in root package.json devDeps
        '@maresia-grill/eslint-config',
        // Used indirectly via @maresia-grill/eslint-config subpackage
        '@eslint/js',
      ],
      ignoreBinaries: ['stripe'],
    },
    'apps/functions': {
      entry: ['src/index.ts', 'tests/**/*.test.ts'],
      project: ['src/**/*.ts'],
    },
  },
  ignore: [
    // packages/tsconfig only contains JSON tsconfig files, not TS source
    'packages/tsconfig/**',
    // Dead code files — genuine findings, scheduled for cleanup
    'apps/web/src/components/ConfirmModal.tsx',
    'apps/web/src/components/Toast.tsx',
    'apps/web/src/lib/customerEmail.ts',
    'apps/web/src/utils.ts',
    // One-time migration scripts, kept for reference
    'tools/scripts/migrate-category-ids.mjs',
    'tools/scripts/migrate-legacy-core.js',
  ],
  // Suppress reports for exports that are also used within the same file
  // (e.g. types.ts re-exports that are used as local type annotations)
  ignoreExportsUsedInFile: true,
};

export default config;
