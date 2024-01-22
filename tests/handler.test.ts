import { getHandlerPaths } from '@/lib/service-finder.ts';
import path from 'node:path';

describe('Handlers', () => {
  const baseDir = path.resolve(process.cwd(), '.ignoreme');

  it('should read directory files for handlers', async () => {
    const res = await getHandlerPaths(baseDir);
    console.log(res);
  });
});
