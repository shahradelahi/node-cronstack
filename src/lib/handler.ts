import { transpileFile } from '@/lib/transpile.ts';
import logger, { ServiceLogger } from '@/logger.ts';
import { Service } from '@/typings.ts';
import { fsAccess } from '@/utils/fs-access.ts';
import { getModule } from '@/utils/get-module.ts';
import { getModuleType } from '@/utils/get-package-info.ts';
import {
  readDirectory,
  readDirectoryFiles,
  separateFilesAndDirectories
} from '@/utils/read-directory-files.ts';
import { promises } from 'node:fs';
import path from 'node:path';

export async function getTranspiledHandler(
  cwd: string,
  handlerPath: HandlerPath
): Promise<Service> {
  const buildDir = path.join(cwd, '.microservice');
  const handlerBuildDir = path.join(buildDir, handlerPath.name);

  if (await fsAccess(handlerBuildDir)) {
    await promises.rm(handlerBuildDir, { recursive: true });
  }

  const format = await getModuleType();

  const relativePath = path.relative(cwd, handlerPath.path);
  logger.log(logger.cyan('[info]'), `Transpiling handler ${relativePath}`);

  // transpile handler
  const { error } = await transpileFile({
    entry: [handlerPath.path],
    outDir: handlerBuildDir,
    format: [format]
  });

  if (error) {
    throw new Error(`Failed to transpile handler ${handlerPath}`);
  }

  const file = path.join(
    handlerBuildDir,
    path.basename(handlerPath.path).replace(/\.(ts|js)$/, '.js')
  );
  if (path.basename(file) !== '+service.js') {
    const newFile = path.join(handlerBuildDir, '+service.js');
    await promises.rename(file, newFile);
    await promises.rename(`${file}.map`, `${newFile}.map`);
  }

  const module = await getModule(path.join(handlerBuildDir, '+service.js'));
  if (!module.default) {
    throw new Error(`Handler ${file} does not have a default export`);
  }

  const handler = format === 'cjs' ? module.default['default'] : module.default;
  // if (!(handler instanceof BaseService)) {
  //   throw new Error(`Handler ${file} must implement BaseService`);
  // }

  const handlerInstance = new (handler as any)() as Service;
  handlerInstance.name = handlerPath.name;
  handlerInstance.logger = ServiceLogger(handlerPath.name);

  return handlerInstance;
}

export async function getHandlers(cwd: string): Promise<Service[]> {
  const handlerPaths = await getHandlerPaths(cwd);

  const handlers: Service[] = [];
  for (const handlerPath of handlerPaths) {
    const handler = await getTranspiledHandler(cwd, handlerPath);
    handlers.push(handler);
  }

  return handlers;
}

type HandlerPath = {
  path: string;
  name: string;
};

/**
 * Get all handler file paths.
 *
 * Directory structure:
 *
 * ```text
 *  services/
 *  ├── <service-name>/
 *  │   └── +service.ts
 *  └── +<service-name>.service.ts
 *  ```
 *
 * Max directory depth: 1
 *
 * @param cwd
 */
export async function getHandlerPaths(cwd: string): Promise<HandlerPath[]> {
  const handlerPath = path.join(cwd, 'services');

  const { data: contents, error } = await readDirectory(handlerPath);
  const { files, directories } = separateFilesAndDirectories(contents || []);

  const paths: HandlerPath[] = [];

  for (const file of files) {
    const regex = /^\+([a-z0-9-]+)\.service\.(ts|js)$/i;
    if (regex.test(file.basename)) {
      paths.push({
        name: file.basename.match(regex)![1].toString(),
        path: file.path
      });
    }
  }

  for (const directory of directories) {
    const { data: files, error } = await readDirectoryFiles(directory.path);
    if (!files || error) {
      throw new Error(`Failed to read directory ${directory.path}`);
    }

    for (const file of files) {
      const filename = path.basename(file);
      const regex = /^\+service\.(ts|js)$/i;
      if (regex.test(filename)) {
        paths.push({
          name: directory.basename,
          path: file
        });
      }
    }
  }

  return paths;
}
