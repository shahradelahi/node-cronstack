import { SafeReturn } from '@/typings.ts';
import { build, Options } from 'tsup';

export async function transpileFile(options: Options): Promise<SafeReturn<boolean>> {
  try {
    await build({
      format: ['esm'], // Specify the desired output formats (CommonJS and ES Module)
      target: 'esnext', // Specify the target environment
      clean: true, // Clean the output directory before building
      bundle: true, // Bundle dependencies imported with esm
      sourcemap: true, // Generate source maps
      ...options,
      platform: 'node', // Specify the target platform
      keepNames: true, // Keep symbol names
      config: false, // Disable config file
      silent: true // Suppress output (default is false)
    });
    return { data: true };
  } catch (error) {
    return { error };
  }
}
