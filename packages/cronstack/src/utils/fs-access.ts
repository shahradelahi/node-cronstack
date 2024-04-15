import { accessSync, promises } from 'node:fs';

export async function fsAccess(path: string): Promise<boolean> {
  try {
    await promises.access(path);
    return true;
  } catch (error) {
    return false;
  }
}

export function fsAccessSync(path: string): boolean {
  try {
    accessSync(path);
    return true;
  } catch (error) {
    return false;
  }
}
