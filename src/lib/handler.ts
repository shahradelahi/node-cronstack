import { transpileFile } from '@/lib/transpile.ts';
import { ServiceLogger } from '@/logger.ts';
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

type TranspiledHandler = {
  filePath: string;
  name: string;
};

export async function transpiledHandler(
  cwd: string,
  handlerPath: HandlerPath
): Promise<TranspiledHandler> {
  const buildDir = path.join(cwd, '.microservice');
  const handlerBuildDir = path.join(buildDir, handlerPath.name);

  if (await fsAccess(handlerBuildDir)) {
    await promises.rm(handlerBuildDir, { recursive: true });
  }

  const format = await getModuleType();

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

  return {
    filePath: path.join(handlerBuildDir, '+service.js'),
    name: handlerPath.name
  };
}

async function getHandler({ filePath, name }: TranspiledHandler): Promise<Service> {
  const format = await getModuleType();

  const module = await getModule(filePath);
  if (!module.default) {
    throw new Error(`Handler ${filePath} does not have a default export`);
  }

  const handler = format === 'cjs' ? module.default['default'] : module.default;
  if (!handler) {
    throw new Error(`Handler not found in ${filePath}`);
  }

  const handlerInstance = new (handler as any)() as Service;
  handlerInstance.name = name;
  handlerInstance.logger = ServiceLogger(name);

  return handlerInstance;
}

type GetHandlerOptions = {
  cwd: string;
  include: string[];
};

export async function getHandlers({ cwd, ...opts }: GetHandlerOptions): Promise<Service[]> {
  let rawPaths = await getHandlerPaths(cwd);

  if (Array.isArray(opts.include) && opts.include.length > 0) {
    rawPaths = rawPaths.filter((handler) => opts.include.includes(handler.name));
  }

  const handlers: Service[] = [];
  const modulePaths = await Promise.all(
    rawPaths.map((handlerPath) => transpiledHandler(cwd, handlerPath))
  );
  for (const modulePath of modulePaths) {
    const handler = await getHandler(modulePath);
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
  if (!contents || error) {
    throw new Error(`Failed to read directory ${handlerPath}`);
  }

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
