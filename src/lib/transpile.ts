import { PACKAGE_NAME } from '@/constants';
import type { SafeReturn, TsupOptions } from '@/typings';
import deepmerge from 'deepmerge';
import { tsup } from '@/lib/imports';

export async function transpileFile(options: TsupOptions): Promise<SafeReturn<boolean>> {
  try {
    const tsupPkg = await tsup();
    await tsupPkg.build(
      deepmerge(
        {
          target: 'esnext', // Specify the target environment
          clean: true, // Clean the output directory before building
          bundle: true, // Bundle dependencies imported with esm
          sourcemap: true, // Generate source maps
          platform: 'node', // Specify the target platform
          keepNames: true, // Keep symbol names
          config: false, // Disable config file
          silent: true, // Suppress output (default is false)
          noExternal: ['node_modules'], // Do not bundle external dependencies
          external: [PACKAGE_NAME, 'tslib', 'chalk'] // Specify external dependencies
        },
        options
      )
    );
    return { data: true };
  } catch (error) {
    return { error };
  }
}
