import { promises } from 'node:fs';
import { join, resolve } from 'node:path';
import { type PackageJson } from 'type-fest';

import { fsAccess } from '@/utils/fs-extra';
import { isJson } from '@/utils/is-json';

export async function getPackageInfo(cwd: boolean | string = false) {
  const packageJsonPath = getPackageFilePath(
    typeof cwd === 'string'
      ? join(cwd, 'package.json')
      : cwd
        ? join(process.cwd(), 'package.json')
        : '../package.json'
  );

  if (!fsAccess(packageJsonPath)) {
    return;
  }

  const content = await promises.readFile(packageJsonPath, 'utf-8');
  if (!content || !isJson(content)) {
    throw new Error('Invalid package.json file');
  }

  return JSON.parse(content) as PackageJson;
}

function getPackageFilePath(filePath: string) {
  if (typeof __dirname === 'undefined') {
    return resolve(import.meta.url, filePath);
  }
  return resolve(__dirname, filePath);
}

export async function getModuleType() {
  const packageJson = await getPackageInfo(true);
  return packageJson?.type === 'module' ? 'esm' : 'cjs';
}
