import { SafeReturn } from '@/typings.ts';
import { promises } from 'fs';
import { join } from 'node:path';

export async function readDirectoryFiles(directoryPath: string): Promise<SafeReturn<string[]>> {
  try {
    const fileNames = await promises.readdir(directoryPath); // returns a JS array of just short/local file-names, not paths.
    const filePaths = fileNames.map((fn) => join(directoryPath, fn));
    return { data: filePaths };
  } catch (err) {
    console.error(err); // depending on your application, this `catch` block (as-is) may be inappropriate; consider instead, either not-catching and/or re-throwing a new Error with the previous err attached.
    return { error: err };
  }
}
