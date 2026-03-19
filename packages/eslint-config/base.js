import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';

export const baseConfig = [
  globalIgnores(['**/dist/**', '**/lib/**', '**/coverage/**', '**/node_modules/**']),
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
];
