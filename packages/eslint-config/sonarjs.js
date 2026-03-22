import sonarjs from 'eslint-plugin-sonarjs';

export const sonarjsConfig = [
  {
    files: ['**/*.{ts,tsx}'],
    extends: [sonarjs.configs.recommended],
    rules: {
      'sonarjs/cognitive-complexity': ['error', 20],
      'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
      // void operator is an accepted TS pattern for fire-and-forget promises
      'sonarjs/void-use': 'off',
      // Math.random() is acceptable for non-security UI purposes
      'sonarjs/pseudo-random': 'off',
      // Generates false positives on auth field names (e.g. "passwordField")
      'sonarjs/no-hardcoded-passwords': 'off',
      // Nested arrow functions are idiomatic in React and hooks
      'sonarjs/no-nested-functions': 'off',
      // Nested ternaries are a common and accepted pattern in JSX templates
      'sonarjs/no-nested-conditional': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      // Repeated strings in tests are intentional for clarity
      'sonarjs/no-duplicate-string': 'off',
    },
  },
];
