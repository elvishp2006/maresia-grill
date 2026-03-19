import globals from 'globals';

export const nodeConfig = [
  {
    files: ['**/*.{ts,js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
];
