import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';

const formatConsoleArgs = (args: unknown[]) => args.map((arg) => {
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}).join(' ');

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation((...args) => {
    throw new Error(`Unexpected console.warn: ${formatConsoleArgs(args)}`);
  });
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    throw new Error(`Unexpected console.error: ${formatConsoleArgs(args)}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
