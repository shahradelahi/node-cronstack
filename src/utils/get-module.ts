import path from 'node:path';

export async function getModule<T = any>(modulePath: string): Promise<T> {
  const absolutePath = path.isAbsolute(modulePath)
    ? modulePath
    : path.resolve(process.cwd(), modulePath);

  return import(absolutePath);
}
