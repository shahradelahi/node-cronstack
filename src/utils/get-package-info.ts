import { isJson } from '@/utils/is-json.ts';
import { promises } from 'node:fs';
import path from 'node:path';
import { type PackageJson } from 'type-fest';

export async function getPackageInfo() {
  const packageJsonPath = getPackageFilePath('../package.json');

  const content = await promises.readFile(packageJsonPath, 'utf-8');
  if (!content || !isJson(content)) {
    throw new Error('Invalid package.json file');
  }

  return JSON.parse(content) as PackageJson;
}

function getPackageFilePath(filePath: string) {
  return path.resolve(__dirname, filePath);
}
