import { fsAccess } from '@/utils/fs-access.ts';
import { readDirectory } from '@/utils/read-directory-files.ts';

describe('utils', () => {
  it('should read directory files', async () => {
    const res = await readDirectory('.');
    console.log(res);
  });

  it('should check if a file exists', async () => {
    const res = await fsAccess('.');
    console.log(res);
  });
});
