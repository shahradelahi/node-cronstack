import { accessSync } from 'node:fs';

export function fsAccess(path: string): boolean {
  try {
    accessSync(path);
    return true;
  } catch (error) {
    return false;
  }
}
