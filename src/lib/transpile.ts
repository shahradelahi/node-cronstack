import { SafeReturn } from '@/typings.ts';
import deepmerge from 'deepmerge';
import { build, Options } from 'tsup';

export async function transpileFile(options: Options): Promise<SafeReturn<boolean>> {
  try {
    await build(
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
          external: ['@litehex/taskflow', 'tslib', 'chalk'] // Specify external dependencies
        },
        options
      )
    );
    return { data: true };
  } catch (error) {
    return { error };
  }
}
