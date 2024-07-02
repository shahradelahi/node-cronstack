import deepmerge from 'deepmerge';
import { trySafe, type SafeReturn } from 'p-safe';

import { PACKAGE_NAME } from '@/constants';
import { tsup } from '@/lib/dynamic-import';
import type { TsupOptions } from '@/typings';

export async function transpileFile(options: TsupOptions): Promise<SafeReturn<boolean>> {
  const { build } = await tsup();
  return trySafe(async () => {
    await build(
      deepmerge(
        {
          skipNodeModulesBundle: true,
          target: 'esnext',
          tsconfig: 'tsconfig.json',
          clean: true,
          bundle: true,
          sourcemap: true,
          platform: 'node',
          keepNames: true,
          config: false,
          silent: true,
          shims: true,
          splitting: true,
          external: [PACKAGE_NAME]
        },
        options
      )
    );
  });
}
