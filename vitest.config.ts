import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@orquestia/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/**/*.test.ts',
        'packages/cli/src/index.ts',
        'packages/cli/src/build-sea.ts',
        'packages/cli/src/sea-entry.ts',
        'packages/cli/src/code-command-wiring.ts',
        'packages/cli/src/plan-command-wiring.ts',
        'packages/cli/src/implement-command-wiring.ts',
        'packages/cli/src/queue-daemon.ts',
        'packages/vscode-extension/src/extension.ts',
        'packages/vscode-extension/src/run-bundle.ts',
      ],
    },
  },
});
