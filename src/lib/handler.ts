import { BUILD_OUTPUT_DIR } from '@/constants.ts';
import { transpileFile } from '@/lib/transpile.ts';
import logger, { ServiceLogger } from '@/logger.ts';
import { Service } from '@/typings.ts';
import { fsAccess } from '@/utils/fs-access.ts';
import { getModule } from '@/utils/get-module.ts';
import { getModuleType } from '@/utils/get-package-info.ts';
import { sendError } from '@/utils/handle-error.ts';
import {
  readDirectory,
  readDirectoryFiles,
  separateFilesAndDirectories
} from '@/utils/read-directory-files.ts';
import chalk from 'chalk';
import { CronJob, CronTime } from 'cron';
import { promises } from 'node:fs';
import path from 'node:path';
import { Options } from 'tsup';

type TranspiledHandler = {
  filePath: string;
  name: string;
};

export async function getHandler({ filePath, name }: TranspiledHandler): Promise<Service> {
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

type GetHandlerOptions = Pick<Options, 'minify' | 'sourcemap' | 'onSuccess'> & {
  cwd: string;
  watch?: boolean;
  include?: string[];
};

export async function getHandlers({
  cwd,
  watch,
  include,
  ...opts
}: GetHandlerOptions): Promise<Service[]> {
  let rawPaths = await getHandlerPaths(cwd);

  if (Array.isArray(include) && include.length > 0) {
    rawPaths = rawPaths.filter((handler) => include.includes(handler.name));
  }

  const buildDir = path.join(cwd, BUILD_OUTPUT_DIR);
  if (await fsAccess(buildDir)) {
    await promises.rm(buildDir, { recursive: true });
  }

  const format = await getModuleType();
  const entryPaths = rawPaths.map((handler) => handler.path);

  // transpile handlers
  const { error } = await transpileFile({
    entry: entryPaths,
    outDir: buildDir,
    format: [format],
    watch: watch ? entryPaths : false,
    ...opts
  });

  if (error) {
    throw new Error('Failed to transpile handlers');
  }

  const modulePaths = rawPaths.map((handler) => ({
    filePath: handler.path.replace(/\.(ts|js)$/, '.js').replace(`${cwd}/services`, buildDir),
    name: handler.name
  }));

  const handlers: Service[] = [];
  for (const modulePath of modulePaths) {
    const handler = await getHandler(modulePath);
    handlers.push(handler);
  }

  return handlers;
}

export type HandlerPath = {
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

export type RegisterOptions = {
  handlers: Service[];
  once?: boolean;
  timeZone?: string;
};

export async function registerHandlers(options: RegisterOptions) {
  const { handlers, ...opts } = options;

  const jobs: Map<string, CronJob> = new Map();

  for (const handlerKey in handlers) {
    const handler: Service = handlers[handlerKey];

    if (jobs.has(handler.name)) {
      logger.log(
        logger.yellow('[warn]'),
        `Job "${chalk.bold(
          handler.name
        )}" not registered because another job with the same name already exists.`
      );
      continue;
    }

    const handleTick = async () => {
      if (handler.preventOverlapping) {
        if (handler.running) {
          logger.log(
            logger.yellow('[warn]'),
            `Job "${chalk.bold(handler.name)}" skipped because it is already running.`
          );
          return;
        }
        handler.running = true;
      }

      try {
        if (handler.verbose) {
          logger.log(chalk.cyan('[info]'), chalk.gray(`[${handler.name}]`), `Job has started.`);
        }
        await handler.handle().then(() => {
          if (handler.verbose) {
            logger.log(
              chalk.green('[success]'),
              chalk.gray(`[${handler.name}]`),
              `Job has completed.`
            );
          }
        });
      } catch (error) {
        logger.log(chalk.red('[error]'), chalk.gray(`[${handler.name}]`), `Job has crashed.`);
        sendError(error);
      }

      if (handler.preventOverlapping) {
        handler.running = false;
      }
    };

    const job: CronJob = new CronJob('* * * * *', handleTick, null, false, opts.timeZone);
    job.addCallback(() => {
      // if opts.once is true, stop the job
      if (opts.once) {
        job.stop();
      }
    });

    const { interval } = handler;
    if (interval instanceof CronTime) {
      job.setTime(interval);
    } else if (typeof (interval as any) === 'string') {
      job.setTime(new CronTime(interval));
    } else {
      throw new Error(
        `Invalid interval type "${typeof handler.interval}" for job "${handler.name}"`
      );
    }

    jobs.set(handler.name, job);
  }

  return jobs;
}
