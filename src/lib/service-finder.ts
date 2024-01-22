import { HandlerPath } from '@/lib/handler.ts';
import {
  readDirectory,
  readDirectoryFiles,
  separateFilesAndDirectories
} from '@/utils/read-directory-files.ts';
import path from 'node:path';

/**
 * Get all handler file paths.
 *
 * Directory structure:
 *
 * ```text
 *  services/
 *  ├── <service-name>/
 *  │   ├── +<service-name>.service.ts
 *  │   └── +service.ts
 *  └── +<service-name>.service.ts
 *  ```
 *
 * @param cwd
 * @param serviceDir The directory where the services are located. Defaults to `services`.
 */
export async function getHandlerPaths(
  cwd: string,
  serviceDir = 'services'
): Promise<HandlerPath[]> {
  const handlerPath = path.join(cwd, serviceDir);

  const { data: contents, error } = await readDirectory(handlerPath);
  if (!contents || error) {
    throw new Error(`Failed to read directory ${handlerPath}`);
  }

  const { files, directories } = separateFilesAndDirectories(contents || []);

  const paths: HandlerPath[] = [];

  // FILE_BASED
  for (const file of files) {
    if (isFileBasedHandler(file.basename)) {
      paths.push({
        name: readNameOfFileBasedHandler(file.basename),
        path: file.path
      });
    }
  }

  for (const directory of directories) {
    const { data: files, error } = await readDirectoryFiles(directory.path);
    if (!files || error) {
      throw new Error(`Failed to read directory ${directory.path}`);
    }

    // DIRECTORY_BASED
    for (const file of files) {
      const filename = path.basename(file);
      if (isDirectoryBasedHandler(filename)) {
        paths.push({
          name: directory.basename,
          path: file
        });
      } else if (isFileBasedHandler(file)) {
        paths.push({
          name: readNameOfFileBasedHandler(file),
          path: file
        });
      }
    }

    // loop through subdirectories
    const subdirectories = await getHandlerPaths(directory.path, '');
    paths.push(...subdirectories);
  }

  return paths;
}

const FILE_BASED_HANDLER_REGEX = /^\+([a-z0-9-]+)\.service\.(ts|js)$/i;

const DIRECTORY_BASED_HANDLER_REGEX = /^\+service\.(ts|js)$/i;

function isFileBasedHandler(handlerPath: string) {
  return FILE_BASED_HANDLER_REGEX.test(handlerPath);
}

function isDirectoryBasedHandler(handlerPath: string) {
  return DIRECTORY_BASED_HANDLER_REGEX.test(path.basename(handlerPath));
}

function readNameOfFileBasedHandler(handlerPath: string) {
  return handlerPath.match(FILE_BASED_HANDLER_REGEX)![1].toString();
}
